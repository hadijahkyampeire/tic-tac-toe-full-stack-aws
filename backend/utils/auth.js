// === utils/auth.js ===
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
 
const REGION = "us-east-2";
const USER_POOL_ID = "us-east-2_azti5AuYe";
 
const client = jwksClient({
  jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
});
 
function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      console.error('JWKS error:', err);
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}
 
exports.verifyCognitoToken = function (token) {
  return new Promise((resolve) => {
    jwt.verify(token, getKey, {
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
    }, (err, decoded) => {
      if (err) {
        console.warn('Token verification failed:', err.message);
        resolve(null);
      } else {
        resolve(decoded);
      }
    });
  });
};