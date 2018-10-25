var async = require('async');
var helpers = require('../../../helpers/aws');

module.exports = {
	title: 'CloudTrail File Validation',
	category: 'CloudTrail',
	description: 'Ensures CloudTrail file validation is enabled for all regions within an account',
	more_info: 'CloudTrail file validation is essentially a hash of the file which can be used to ensure its integrity in the case of an account compromise.',
	recommended_action: 'Enable CloudTrail file validation for all regions',
	link: 'http://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-enabling.html',
	apis: ['CloudTrail:describeTrails'],
	compliance: {
        hipaa: 'The auditing requirements of HIPAA require logs to be kept securely ' +
        		'in a manner that prevents tampering. CloudTrail log validation ' +
        		'provides a mechanism of validating that the logs generated by ' +
        		'AWS have not been modified, ensuring the integrity of the log data.'
    },

	run: function(cache, settings, callback) {
		var results = [];
		var source = {};
		var regions = helpers.regions(settings.govcloud);

		async.each(regions.cloudtrail, function(region, rcb){
			var describeTrails = helpers.addSource(cache, source,
				['cloudtrail', 'describeTrails', region]);

			if (!describeTrails) return rcb();

			if (describeTrails.err || !describeTrails.data) {
				helpers.addResult(results, 3,
					'Unable to query for CloudTrail file validation status: ' + helpers.addError(describeTrails), region);
				return rcb();
			}

			if (!describeTrails.data.length) {
				helpers.addResult(results, 2, 'CloudTrail is not enabled', region);
			} else if (describeTrails.data[0]) {
				for (t in describeTrails.data) {
					if (!describeTrails.data[t].LogFileValidationEnabled) {
						helpers.addResult(results, 2, 'CloudTrail log file validation is not enabled',
							region, describeTrails.data[t].TrailARN)
					} else {
						helpers.addResult(results, 0, 'CloudTrail log file validation is enabled',
							region, describeTrails.data[t].TrailARN)
					}
				}
			} else {
				helpers.addResult(results, 2, 'CloudTrail is enabled but is not properly configured', region);
			}
			rcb();
		}, function(){
			callback(null, results, source);
		});
	}
};