'use strict';

const httpStatus = require('http-status-codes');

const { carryOverDb } = require('abacus-test-helper');
const { serviceMock } = require('abacus-mock-util');

let fixture;
let createUnhandleableEvents;

const build = () => {
  context('when reading unhandleable events from Cloud Controller', () => {
    let externalSystemsMocks;
    let unhandleableEvents;

    before(async () => {
      externalSystemsMocks = fixture.externalSystemsMocks();
      externalSystemsMocks.startAll();

      externalSystemsMocks.uaaServer.tokenService
        .whenScopesAre(fixture.oauth.abacusCollectorScopes)
        .return(fixture.oauth.abacusCollectorToken);

      externalSystemsMocks.uaaServer.tokenService
        .whenScopesAre(fixture.oauth.cfAdminScopes)
        .return(fixture.oauth.cfAdminToken);

      unhandleableEvents = createUnhandleableEvents(fixture);
      externalSystemsMocks.cloudController.usageEvents.return.firstTime(unhandleableEvents);

      externalSystemsMocks.abacusCollector.collectUsageService.return.always(httpStatus.ACCEPTED);

      await carryOverDb.setup();
      fixture.bridge.start(externalSystemsMocks);

      await eventually(serviceMock(externalSystemsMocks.cloudController.usageEvents).received(2));
    });

    after((done) => {
      fixture.bridge.stop();
      carryOverDb.teardown();
      externalSystemsMocks.stopAll(done);
    });

    it('Abacus collector does not receive any usage', () => {
      expect(externalSystemsMocks.abacusCollector.collectUsageService.requests().length).to.equal(0);
    });

    it('Does not write an entry in carry over', async () => {
      const docs = await carryOverDb.readCurrentMonthDocs();
      expect(docs).to.deep.equal([]);
    });

    it('Exposes correct statistics', async () => {
      const response = await fixture.bridge.readStats.withValidToken();
      expect(response.statusCode).to.equal(httpStatus.OK);
      expect(response.body.statistics.usage).to.deep.equal({
        success: {
          all: unhandleableEvents.length,
          conflicts: 0,
          notsupported: 0,
          skips: unhandleableEvents.length
        },
        failures: 0
      });
    });
  });
};

const testDef = {
  fixture: (value) => {
    fixture = value;
    return testDef;
  },
  unhandleableEvents: (value) => {
    createUnhandleableEvents = value;
    return testDef;
  },
  build
};

module.exports = testDef;
