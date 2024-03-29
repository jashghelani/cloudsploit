var expect = require('chai').expect;
var vmEncryptionAtHost = require('./vmEncryptionAtHost');

const virtualMachines = [
    {
        'name': 'test-vm',
        'id': '/subscriptions/123/resourceGroups/AQUA-RESOURCE_GROUP/providers/Microsoft.Compute/virtualMachines/test-vm',
        'type': 'Microsoft.Compute/virtualMachines',
        'storageProfile': {
            'imageReference': {
                'id': '/subscriptions/123/resourceGroups/aqua-resource-group/providers/Microsoft.Compute/galleries/myGallery/images/test-def-1/versions/1.0.0',
                'exactVersion': '1.0.0'
            }
        },
        'securityProfile': {
            'encryptionAtHost': true
        }
    },
    {
        'name': 'test-vm',
        'id': '/subscriptions/123/resourceGroups/AQUA-RESOURCE_GROUP/providers/Microsoft.Compute/virtualMachines/test-vm',
        'type': 'Microsoft.Compute/virtualMachines',
        'storageProfile': {
            'imageReference': {
                'publisher': 'Canonical',
                'offer': 'UbuntuServer',
                'sku': '18.04-LTS',
                'version': 'latest',
                'exactVersion': '18.04.202007160'
            }
        }
    }
];

const createCache = (virtualMachines) => {
    let machine = {};
    if (virtualMachines) {
        machine['data'] = virtualMachines;
    }
    return {
        virtualMachines: {
            listAll: {
                'eastus': machine
            }
        }
    };
};

describe('vmEncryptionAtHost', function() {
    describe('run', function() {
        it('should give passing result if no virtual machines', function(done) {
            const cache = createCache([]);
            vmEncryptionAtHost.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('No existing Virtual Machines found');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });

        it('should give unknown result if unable to query for virtual machines', function(done) {
            const cache = createCache(null);
            vmEncryptionAtHost.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(3);
                expect(results[0].message).to.include('Unable to query for Virtual Machines:');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });

        it('should give passing result if VM has encryption at host enabled for disks', function(done) {
            const cache = createCache([virtualMachines[0]]);
            vmEncryptionAtHost.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(0);
                expect(results[0].message).to.include('Encryption at host is enabled for virtual machine disks');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });

        it('should give failing result if VM does not have encryption at host enabled for disks', function(done) {
            const cache = createCache([virtualMachines[1]]);
            vmEncryptionAtHost.run(cache, {}, (err, results) => {
                expect(results.length).to.equal(1);
                expect(results[0].status).to.equal(2);
                expect(results[0].message).to.include('Encryption at host is not enabled for virtual machine disks');
                expect(results[0].region).to.equal('eastus');
                done();
            });
        });
    });
});