var async = require('async');
var helpers = require('../../../helpers/alibaba');

module.exports = {
    title: 'System Disks Encryption',
    category: 'ECS',
    domain: 'Compute',
    severity: 'High',
    description: 'Ensure that encryption is enabled for ECS system disk volumes.',
    more_info: 'Encryption can help you secure your data stored in Alibaba Cloud ECS and comply with security standards.',
    link: 'https://www.alibabacloud.com/help/doc-detail/59643.htm',
    recommended_action: 'Enable encryption for ECS system disk volumes.',
    apis: ['ECS:DescribeDisks', 'KMS:ListKeys', 'KMS:DescribeKey', 'STS:GetCallerIdentity'],
    compliance: {
        hipaa: 'HIPAA requires that all data is encrypted, including data at rest. ' +
                'ECS disk is a HIPAA-compliant solution that provides automated encryption ' +
                'of ECS instance data at rest.',
        pci: 'PCI requires proper encryption of cardholder data at rest. Encryption ' +
             'should be enabled for all disk volumes storing this type of data.'
    },
    settings: {
        system_disks_encryption_level: {
            name: 'ECS system Disks Encryption Level',
            description: 'In order (lowest to highest) cloudkms=Alibaba managed default service KMS; alibabacmk=Customer managed KMS; externalcmk=Customer imported key; cloudhsm=Customer managed CloudHSM sourced Key',
            regex: '^(cloudkms|alibabacmk|externalcmk|cloudhsm)$',
            default: 'cloudkms',
        }
    },

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var regions = helpers.regions(settings);
        var defaultRegion = helpers.defaultRegion(settings);

        var accountId = helpers.addSource(cache, source, ['sts', 'GetCallerIdentity', defaultRegion, 'data']);

        var targetEncryptionLevel = helpers.ENCRYPTION_LEVELS.indexOf(settings.system_disks_encryption_level || this.settings.system_disks_encryption_level.default);

        async.each(regions.ecs, function(region, rcb) {
            var describeDisks = helpers.addSource(cache, source, ['ecs', 'DescribeDisks', region]);
            if (!describeDisks) return rcb();

            if (describeDisks.err || !describeDisks.data) {
                helpers.addResult(results, 3, 'Unable to query ECS disks: ' + helpers.addError(describeDisks), region);
                return rcb();
            }

            if (!describeDisks.data.length) {
                helpers.addResult(results, 0, 'No ECS disks found', region);
                return rcb();
            }

            var listKeys = helpers.addSource(cache, source, ['kms', 'ListKeys', region]);

            if (!listKeys || listKeys.err || !listKeys.data) {
                helpers.addResult(results, 3, 'Unable to query KMS keys: ' + helpers.addError(listKeys), region);
                return rcb();
            }

            var found = false;
          
            async.each(describeDisks.data, (disk, dcb) => {
                if (!disk.DiskId || (disk.Type && disk.Type.toLowerCase() !== 'system')) return dcb();

                found = true;
                let resource = helpers.createArn('ecs', accountId, 'disk', disk.DiskId, region);

                if (!disk.Encrypted) {
                    helpers.addResult(results, 2,
                        `System disk is not encrypted to ${helpers.ENCRYPTION_LEVELS[targetEncryptionLevel]}`,
                        region, resource);
                    return dcb();
                }

                if (!disk.KMSKeyId) {
                    if (targetEncryptionLevel > 2) {
                        helpers.addResult(results, 2,
                            `System disk is not encrypted to ${helpers.ENCRYPTION_LEVELS[targetEncryptionLevel]}`,
                            region, resource);
                    } else {
                        helpers.addResult(results, 0, `System disk is encrypted to at least ${helpers.ENCRYPTION_LEVELS[targetEncryptionLevel]}`,
                            region, resource);
                    }

                    return dcb();
                }

                var describeKey = helpers.addSource(cache, source, ['kms', 'DescribeKey', region, disk.KMSKeyId]);

                if (!describeKey || describeKey.err || !describeKey.data) {
                    let keyResource = helpers.createArn('kms', accountId, 'key', disk.KMSKeyId, region);
                    helpers.addResult(results, 3,
                        `Unable to describe KMS key: ${helpers.addError(describeKey)}`,
                        region, keyResource);
                    return dcb();
                }

                var currentEncryptionLevel = helpers.getEncryptionLevel(describeKey.data, helpers.ENCRYPTION_LEVELS);

                if (currentEncryptionLevel < targetEncryptionLevel) {
                    helpers.addResult(results, 2,
                        `System disk is not encrypted to ${helpers.ENCRYPTION_LEVELS[targetEncryptionLevel]}`,
                        region, resource);
                } else {
                    helpers.addResult(results, 0, `System disk is encrypted to at least ${helpers.ENCRYPTION_LEVELS[targetEncryptionLevel]}`,
                        region, resource);
                }
                dcb();
            }, function() {
                if (!found) {
                    helpers.addResult(results, 0, 'No ECS system disks found', region);
                }
                rcb();
            });
        }, function(){
            callback(null, results, source);
        });
    }
};
