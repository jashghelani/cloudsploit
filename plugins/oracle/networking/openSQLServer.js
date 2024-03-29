var async = require('async');
var helpers = require('../../../helpers/oracle/');

module.exports = {
    title: 'Open SQLServer',
    category: 'Networking',
    domain: 'Network Access Control',
    severity: 'High',
    description: 'Determine if TCP port 1433 or UDP port 1434 for SQL Server is open to ' +
        'the public',
    more_info: 'While some ports such as HTTP and HTTPS are required to be open to the ' +
        'public to function properly, more sensitive services such as SQL server should ' +
        'be restricted to known IP addresses.',
    recommended_action: 'Restrict TCP port 1433 and UDP port 1434 to known IP addresses',
    link: 'https://docs.cloud.oracle.com/iaas/Content/Network/Concepts/securitylists.htm',
    apis: ['vcn:list', 'securityList:list','networkSecurityGroup:list','securityRule:list'],

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var regions = helpers.regions(settings.govcloud);
        var isSecurityRule = false;

        async.each(regions.securityList, function(region, rcb){

            if (helpers.checkRegionSubscription(cache, source, results, region)) {
                var ruleEmpty = false;
                var listEmpty = false;

                var ports = {
                    'udp': [1434],
                    'tcp': [1433]
                };

                var service = 'SQL Server';

                var getSecurityLists = helpers.addSource(cache, source,
                    ['securityList', 'list', region]);

                if (getSecurityLists && getSecurityLists.err)  {

                    helpers.addResult(results, 3,
                        'Unable to query for security lists: ' +
                        helpers.addError(getSecurityLists), region);

                } else if (getSecurityLists &&
                    (!getSecurityLists.data || !getSecurityLists.data.length)) {
                    listEmpty = true;

                } else if (getSecurityLists) {
                    helpers.findOpenPorts(getSecurityLists.data, ports,
                        service, region, results, isSecurityRule);
                }

                var getSecurityRules = helpers.addSource(cache, source,
                    ['securityRule', 'list', region]);

                if (getSecurityRules && getSecurityRules.err)  {

                    helpers.addResult(results, 3,
                        'Unable to query for security rules: ' +
                        helpers.addError(getSecurityRules), region);

                } else if (getSecurityRules &&
                    (!getSecurityRules.data || !getSecurityRules.data.length)) {
                    ruleEmpty = true;

                } else if (getSecurityRules) {
                    var getSecurityGroups = helpers.addSource(cache, source,
                        ['networkSecurityGroup', 'list', region]);

                    isSecurityRule = true;

                    helpers.findOpenPorts(getSecurityRules.data, ports,
                        service, region, results, isSecurityRule, getSecurityGroups);
                }

                if (ruleEmpty && listEmpty) {
                    helpers.addResult(results, 0,
                        'No security rules or lists found', region);
                } else if (ruleEmpty) {
                    helpers.addResult(results, 0, 'No security rules found', region);
                } else if (listEmpty) {
                    helpers.addResult(results, 0, 'No security lists found', region);
                }
            }

            rcb();
        }, function(){
            // Global checking goes here
            callback(null, results, source);
        });
    }
};