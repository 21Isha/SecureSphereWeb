import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "eu-north-1_VqcPCQgNW",
      userPoolClientId: "3trgnabnm43o200ftp352dvcm",
      loginWith: {
        email: true,
      },
    },
  },
});