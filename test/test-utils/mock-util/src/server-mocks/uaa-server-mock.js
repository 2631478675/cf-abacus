'use strict';

const httpStatus = require('http-status-codes');
const isEqual = require('underscore').isEqual;

const debug = require('abacus-debug')('uaa-server-mock');
const express = require('express');

const createMockServiceData = require('./mock-service-data');

const randomPort = 0;

const extractCredentials = (authHeader) => {
  const encodedCredentials = authHeader.split(' ')[1];
  const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString();
  const credentialsArray = decodedCredentials.split(':');

  return {
    clientId: credentialsArray[0],
    secret: credentialsArray[1]
  };
};

module.exports = () => {
  let app;
  let server;

  const serviceData = createMockServiceData();

  const start = (cb) => {
    app = express();

    let address;

    app.post('/oauth/token', (request, response) => {
      debug('Called /oauth/token endpoint with query %j and headers: %j', request.query, request.headers);
      const queryScopes = request.query.scope || '';
      serviceData.requests().push({
        credentials: extractCredentials(request.header('Authorization')),
        scopes: queryScopes ? queryScopes.split(' ') : []
      });

      const responseToken = serviceData.responseFor(queryScopes);

      debug('Returning OAuth Token: %s', responseToken);
      response.status(httpStatus.OK).send({
        access_token: responseToken,
        expires_in: 5 * 60
      });
    });

    server = app.listen(randomPort, (err) => {
      if (err) {
        cb(err);
        return;
      }

      address = server.address();
      debug('UAA server started on port: %d', address.port);
      cb();
    });
    
  };

  const stop = (cb) => {
    server.close(cb);
  };

  return {
    start,
    url: () => `http://localhost:${server.address().port}`,
    tokenService: {
      clear: serviceData.clear,
      requestsCount: () => serviceData.requests().length,
      requests: {
        withScopes: (scopes) => {
          return serviceData.requests().filter((request) => isEqual(request.scopes, scopes));
        }
      },
      returnNothing: serviceData.return.nothing,
      whenScopesAre: (scopes) => {
        const serializedScopes = scopes.join(' ');
        return {
          return: (returnValue) => {
            serviceData.return.for(serializedScopes).value(returnValue);
          }
        };
      }
    },
    stop
  };
};
