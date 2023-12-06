var expect = require('chai').expect;
var diagnosticLoggingEnabled = require('./diagnosticLoggingEnabled');

const servers = [
    {
        "id": "/subscriptions/jk34n234k-dwef/resourceGroups/test-rg/providers/Microsoft.DBforPostgreSQL/servers/test-server",
    },
];
   
    
const diagnosticSettings = [
    {
        id: '/subscriptions/234/myrg/providers/Microsoft.DBforPostgreSQL/servers/test/providers/microsoft.insights/diagnosticSettings/test-setting',
        type: 'Microsoft.Insights/diagnosticSettings',
        name: 'server-setting',
        location: 'eastus',
        kind: null,
        tags: null,
        eventHubName: null,
        metrics: [],
        logs: [
            {
              "category": null,
              "categoryGroup": "allLogs",
              "enabled": true,
              "retentionPolicy": {
                "enabled": false,
                "days": 0
              }
            },
            {
              "category": null,
              "categoryGroup": "audit",
              "enabled": false,
              "retentionPolicy": {
                "enabled": false,
                "days": 0
              }
            }
          ],
        logAnalyticsDestinationType: null
    }
];

const createCache = (servers, ds) => {
    const id = servers && servers.length ? servers[0].id : null;
    return {
        servers: {
            listPostgres: {
                'eastus': {
                    data: servers
                }
            }
        },
        diagnosticSettings: {
            listByPostgresServers: {
                'eastus': { 
                    [id]: { 
                        data: ds 
                    }
                }
            }

        },
    };
};

describe('diagnosticLoggingEnabled', function() {
    describe('run', function() {
        it('should give a passing result if no PostgreSQL Servers are found', function (done) {
            const cache = createCache([], null);
            diagnosticLoggingEnabled.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('No existing PostgreSQL Servers found');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });

        it('should give unknown result if unable to query for PostgreSQL Servers', function (done) {
            const cache = createCache(null, ['error']);
            diagnosticLoggingEnabled.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(3);
                expect(results[0].message).to.include('Unable to query for PostgreSQL Servers');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });
        it('should give unknown result if unable to query for diagnostic settings', function(done) {
            const cache = createCache([servers[0]], null);
            diagnosticLoggingEnabled.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(3);
                expect(results[0].message).to.include('Unable to query for PostgreSQL Server diagnostic settings');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });

        it('should give passing result if diagnostic logs enabled', function(done) {
            const cache = createCache([servers[0]], [diagnosticSettings[0]]);
            diagnosticLoggingEnabled.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('PostgreSQL Server has diagnostic logs enabled');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });

        it('should give failing result if diagnostic logs not enabled', function(done) {
            const cache = createCache([servers[0]], [[]]);
            diagnosticLoggingEnabled.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(2);
                expect(results[0].message).to.include('PostgreSQL Server does not have diagnostic logs enabled');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });
    });
});
