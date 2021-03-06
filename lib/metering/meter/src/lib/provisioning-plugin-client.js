'use strict';

const httpStatus = require('http-status-codes');
const util = require('util');
const { extend } = require('underscore');

const retry = require('abacus-retry');
const breaker = require('abacus-breaker');
const batch = require('abacus-batch');
const request = require('abacus-request');

const debug = require('abacus-debug')('abacus-usage-metering-provisioning-plugin-client');
const edebug = require('abacus-debug')('e-abacus-usage-metering-provisioning-plugin-client');

const brequest = retry(breaker(batch(request)));
const batchedGetRequest = util.promisify(brequest.get);

const buildUrl = (rootUrl, resourceId) => `${rootUrl}/v1/provisioning/resources/${resourceId}/type`;

const getRequestOptions = (authHeader) => {
  const options = {
    cache: true
  };

  if (authHeader)
    extend(options, {
      headers: {
        authorization: authHeader
      }
    });

  return options;
};

class ProvisioningPluginClient {

  constructor(rootUrl, auth) {
    if(!rootUrl)
      throw new Error('Root URL is not provided.');

    this.rootUrl = rootUrl;
    this.auth = auth;
  }

  async getResourceType(resourceId) {
    debug('Retrieving resource type for resource id %s', resourceId);

    const res = await batchedGetRequest(
      buildUrl(this.rootUrl, resourceId),
      getRequestOptions(this.auth && await this.auth.createHeader())
    );

    if (res.statusCode !== httpStatus.OK) {
      const errorMessage = `Failed to get resource type for resource ${resourceId}. ` +
        `Response ${res.satusCode} ${res.body}`;
      edebug(errorMessage);
      debug(errorMessage);
      throw new Error(errorMessage);
    }

    return res.body;
  };
}

module.exports = ProvisioningPluginClient;
