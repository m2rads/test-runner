# Test Runner

Test Runner is an automated UI regression testing server that executes tests on multiple browsers and provides a VNC connection for real-time viewing of test execution.

## Features

- Executes UI regression tests on Chrome, Firefox, and Safari
- Provides a VNC connection for real-time test execution viewing
- Uses Swagger for API documentation
- Connects to a PostgreSQL database to fetch test scripts
- Supports Docker for easy deployment

## Prerequisites

- Node.js (v14 or later)
- npm
- Docker (for containerized deployment)
- Xvfb and x11vnc (for VNC functionality)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/shor-test-runner.git
   cd shor-test-runner
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add your PostgreSQL credentials:
   ```
   POSTGRES_USER=your_username
   POSTGRES_HOST=your_host
   POSTGRES_PASSWORD=your_password
   POSTGRES_DATABASE=your_database
   ```

## Usage

### Development

To run the server in development mode: