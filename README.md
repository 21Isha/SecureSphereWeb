# SecureSphere 🔐
## Secure Authentication Using Amazon Cognito

SecureSphere is a web-based authentication application developed using React and TypeScript, integrated with Amazon Cognito for secure user authentication.

## Features

- User registration and sign-in
- Email verification using confirmation codes
- Forgot password functionality
- Password reset
- Authenticated user dashboard
- Existing session detection
- Secure sign-out
- User email display

## Technologies Used

- React
- TypeScript
- Vite
- AWS Amplify
- Amazon Cognito
- CSS

## Authentication Flow

1. Users register with their name, email, and password.
2. Amazon Cognito sends a verification code to the user's email.
3. Users verify their email address.
4. Registered users sign in to the application.
5. The app checks the user's authentication session.
6. Authenticated users can access the SecureSphere dashboard.
7. Users can reset their password or sign out.

## Project Structure

```text
SecureSphereWeb/
├── public/
├── src/
│   ├── App.tsx
│   ├── amplify.ts
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
└── README.md
```

## Amazon Cognito Configuration

This application uses an existing Amazon Cognito User Pool.

The authentication configuration is maintained in `src/amplify.ts`.

For your own deployment, configure your AWS Region, User Pool ID, and App Client ID.

Never commit AWS credentials, passwords, or app client secrets to GitHub.

## Installation

Clone the repository and navigate to the project directory.

Install the dependencies:

```bash
npm install
```

## Run the Application

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

## Build

To create a production build, run:

```bash
npm run build
```

## Purpose

SecureSphere demonstrates how Amazon Cognito and AWS Amplify can be integrated into a React application to provide user authentication and session management.

## Author

Isha  
Computer Science Undergraduate  
KL University
