var expect = require('chai').expect;
var noPublicAccess = require('./noPublicAccess');

const servers = [
    {
        "id": "/subscriptions/123/resourceGroups/test-rg/providers/Microsoft.Sql/servers/test-server",
        "publicNetworkAccess" : "Disabled"
    },
    {
        "kind": "v12.0",
        "location": "eastus",
        "tags": { 'key': 'value' },
        "id": "/subscriptions/123/resourceGroups/akhtar-rg/providers/Microsoft.Sql/servers/test-server",
        "name": "test-server",
        "type": "Microsoft.Sql/servers",
        "administratorLogin": "aqua",
        "version": "12.0",
        "state": "Ready",
        "fullyQualifiedDomainName": "test-server.database.windows.net",
        "privateEndpointConnections": [],
        "minimalTlsVersion": "1.1",
        "publicNetworkAccess": "Enabled"
    },
];

const firewallRules = [
    {
        "id": "/subscriptions/123/resourceGroups/test-rg/providers/Microsoft.Sql/servers/test-server/firewallRules/AllowAllWindowsAzureIps",
        "name": "AllowAllWindowsAzureIps",
        "type": "Microsoft.Sql/servers/firewallRules",
        "location": "East US",
        "kind": "v12.0",
        "startIpAddress": "72.255.51.41",
        "endIpAddress": "72.255.51.41"
    },
    {
        "id": "/subscriptions/123/resourceGroups/test-rg/providers/Microsoft.Sql/servers/test-server/firewallRules/AllowAllWindowsAzureIps",
        "name": "AllowAllWindowsAzureIps",
        "type": "Microsoft.Sql/servers/firewallRules",
        "location": "East US",
        "kind": "v12.0",
        "startIpAddress": "0.0.0.0",
        "endIpAddress": "0.0.0.0"
    },
    {
        "id": "/subscriptions/123/resourceGroups/test-rg/providers/Microsoft.Sql/servers/test-server/firewallRules/AllowAllWindowsAzureIps",
        "name": "AllowAllWindowsAzureIps",
        "type": "Microsoft.Sql/servers/firewallRules",
        "location": "East US",
        "kind": "v12.0",
        "startIpAddress": "0.0.0.0",
        "endIpAddress": "255.255.255.255"
    }
];

const createCache = (servers, rules, serversErr, rulesErr) => {
    const serverId = (servers && servers.length) ? servers[0].id : null;
    return {
        servers: {
            listSql: {
                'eastus': {
                    err: serversErr,
                    data: servers
                }
            }
        },
        firewallRules: {
            listByServer: {
                'eastus': {
                    [serverId]: {
                        err: rulesErr,
                        data: rules
                    }
                }
            }
        }
    }
};

describe('noPublicAccess', function() {
    describe('run', function() {
        it('should give passing result if no SQL servers found', function(done) {
            const callback = (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('No SQL servers found');
                expect(results[0].region).to.equal('eastus');
                done()
            };

            const cache = createCache(
                []
            );

            noPublicAccess.run(cache, {}, callback);
        });

        it('should give passing result if no existing SQL Server Firewall Rules found', function(done) {
            const callback = (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('No existing SQL Server Firewall Rules found');
                expect(results[0].region).to.equal('eastus');
                done()
            };

            const cache = createCache(
                [servers[1]],
                []
            );

            noPublicAccess.run(cache, {}, callback);
        });
        it('should give passing result if SQL Server has prive netwrok access disabled', function(done) {
            const callback = (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('The SQL server has public network access disabled');
                expect(results[0].region).to.equal('eastus');
                done()
            };

            const cache = createCache(
                [servers[0]],
                []
            );

            noPublicAccess.run(cache, {}, callback);
        });

        it('should give failing result if SQL Server is open to outside traffic', function(done) {
            const callback = (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(2);
                expect(results[0].message).to.include('SQL Server is open to outside traffic');
                expect(results[0].region).to.equal('eastus');
                done()
            };

            const cache = createCache(
                [servers[1]],
                [firewallRules[1]]
            );

            noPublicAccess.run(cache, {}, callback);
        });

        it('should give failing result if SQL Server firewall end IP setting is enabled and firewall end IP matches the set value', function(done) {
            const callback = (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(2);
                expect(results[0].message).to.include('SQL Server is open to outside traffic');
                expect(results[0].region).to.equal('eastus');
                done()
            };

            const cache = createCache(
                [servers[1]],
                [firewallRules[2]]
            );

            noPublicAccess.run(cache, { server_firewall_end_ip: '255.255.255.255' }, callback);
        });

        it('should give passing result if The SQL server is protected from outside traffic', function(done) {
            const callback = (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('The SQL server is protected from outside traffic');
                expect(results[0].region).to.equal('eastus');
                done()
            };

            const cache = createCache(
                [servers[1]],
                [firewallRules[0]]
            );

            noPublicAccess.run(cache, {}, callback);
        });

        it('should give unknown result if unable to query for SQL servers', function(done) {
            const callback = (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(3);
                expect(results[0].message).to.include('Unable to query for SQL servers');
                expect(results[0].region).to.equal('eastus');
                done()
            };

            const cache = createCache(
                servers,
                [],
                { message: 'unable to query servers'}
            );

            noPublicAccess.run(cache, {}, callback);
        });

        it('should give unknown result if Unable to query for server firewall rules', function(done) {
            const callback = (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(3);
                expect(results[0].message).to.include('Unable to query for server firewall rules');
                expect(results[0].region).to.equal('eastus');
                done()
            };

            const cache = createCache(
                [servers[1]],
                [],
                null,
                { message: 'Unable to query for server firewall rules'}
            );

            noPublicAccess.run(cache, {}, callback);
        });
    })
})