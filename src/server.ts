import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import firefox from 'selenium-webdriver/firefox';
import safari from 'selenium-webdriver/safari';
import { spawn } from 'child_process';
import WebSocket from 'ws';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

const app = express();
const host = process.env.HOST || '0.0.0.0';
const ports = [3000, 8080];
let currentPortIndex = 0;

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Automation UI Regression Test API',
      version: '1.0.0',
      description: 'API for running automation UI regression tests',
    },
    servers: [
      {
        url: '{protocol}://{hostname}:{port}',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'http'
          },
          hostname: {
            default: host
          },
          port: {
            default: ports[0].toString()
          }
        }
      },
    ],
  },
  apis: ['./src/server.ts'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  host: 'aws-0-us-west-1.pooler.supabase.com',
  database: 'postgres',
  password: 'JWqHcNp8*5KJX5-',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// VNC setup
const startVNC = () => {
  spawn('Xvfb', [':99', '-ac', '-screen', '0', '1280x1024x24']);
  const vncProcess = spawn('x11vnc', ['-display', ':99', '-forever', '-nopw', '-listen', 'localhost', '-xkb']);
  
  // WebSocket server for VNC
  const wss = new WebSocket.Server({ port: 8080 });
  
  vncProcess.stdout.on('data', (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });
};

// Test execution
async function runTest(testScript: string, browser: string) {
  let driver;
  let options;

  switch (browser) {
    case 'chrome':
      options = new chrome.Options();
      options.addArguments('--display=:99');
      driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
      break;
    case 'firefox':
      options = new firefox.Options();
      options.addArguments('--display=:99');
      driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
      break;
    case 'safari':
      options = new safari.Options();
      driver = await new Builder().forBrowser('safari').setSafariOptions(options).build();
      break;
    default:
      throw new Error('Unsupported browser');
  }

  try {
    // Execute test script
    await eval(testScript);
  } finally {
    await driver.quit();
  }
}

/**
 * @swagger
 * /execute-test/{id}:
 *   post:
 *     summary: Execute a test
 *     description: Fetches a test script from the database and executes it on multiple browsers
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the test to execute
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Test executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Test not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
interface ExecuteTestParams extends ParamsDictionary {
  id: string;
}

app.post<ExecuteTestParams, any, any, ParsedQs, Record<string, any>>('/execute-test/:id', async (req: Request<ExecuteTestParams>, res: Response) => {
  const testId = req.params.id;
  
  try {
    const { rows } = await pool.query('SELECT test_script FROM tests WHERE id = $1', [testId]);
    
    if (rows.length === 0) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }
    
    const testScript = rows[0].test_script;
    
    startVNC();
    
    // Run tests on major browsers
    await Promise.all([
      runTest(testScript, 'chrome'),
      runTest(testScript, 'firefox'),
      runTest(testScript, 'safari')
    ]);
    
    res.json({ message: 'Tests executed successfully' });
  } catch (error) {
    console.error('Error executing tests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function startServer(portIndex: number) {
  const port = ports[portIndex];
  app.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
    console.log(`Swagger UI available at http://${host}:${port}/api-docs`);
  }).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying next port`);
      if (portIndex < ports.length - 1) {
        startServer(portIndex + 1);
      } else {
        console.error('All ports are busy. Unable to start server.');
      }
    } else {
      console.error(err);
    }
  });
}

startServer(currentPortIndex);