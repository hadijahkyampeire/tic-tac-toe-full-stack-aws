import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      // @ts-expect-error Cognito config structure not recognized by types
      region: 'us-east-1',
      userPoolId: 'us-east-1_6VPoqWJgk', // your Cognito User Pool ID
      userPoolClientId: '46d83gdio78cc9jbkp34os7u9r', // your Cognito App Client ID
    },
  },
});
