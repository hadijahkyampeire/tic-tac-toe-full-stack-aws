import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      // @ts-expect-error Cognito config structure not recognized by types
      region: 'us-east-2',
      userPoolId: 'us-east-2_azti5AuYe', // your Cognito User Pool ID
      userPoolClientId: '69n7h74t2i1ru07t464g51gi6m', // your Cognito App Client ID
    },
  },
});
