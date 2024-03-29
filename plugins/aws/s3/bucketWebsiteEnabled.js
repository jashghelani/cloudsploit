var helpers = require('../../../helpers/aws');

module.exports = {
    title: 'S3 Bucket Website Enabled',
    category: 'S3',
    domain: 'Storage',
    severity: 'High',
    description: 'Ensures S3 buckets are not configured with static website hosting',
    more_info: 'S3 buckets should not be configured with static website hosting with public objects. Instead, a CloudFront distribution should be configured with an origin access identity.',
    recommended_action: 'Disable S3 bucket static website hosting in favor or CloudFront distributions.',
    link: 'https://aws.amazon.com/premiumsupport/knowledge-center/cloudfront-https-requests-s3/',
    apis: ['S3:listBuckets', 'S3:getBucketWebsite', 'S3:getBucketLocation', 'S3:listObjects'],
    settings: {
        s3_website_whitelist_empty_buckets: {
            name: 'S3 Website Whitelist Empty Buckets',
            description: 'When set to true, whitelist empty buckets without checking bucket website configutation',
            regex: '^(true|false)$',
            default: 'false'
        }
    },
    realtime_triggers: ['s3:CreateBucket', 's3:PutBucketWebsite', 's3:DeleteBucketWebsite','s3:DeleteBucket'],

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};

        var region = helpers.defaultRegion(settings);
        var awsOrGov = helpers.defaultPartition(settings);
        var config = {
            s3_website_whitelist_empty_buckets: settings.s3_website_whitelist_empty_buckets || this.settings.s3_website_whitelist_empty_buckets.default,
        };
        var ignoreEmptyBuckets = (config.s3_website_whitelist_empty_buckets == 'true');

        var listBuckets = helpers.addSource(cache, source,
            ['s3', 'listBuckets', region]);

        if (!listBuckets) return callback(null, results, source);

        if (listBuckets.err || !listBuckets.data) {
            helpers.addResult(results, 3,
                'Unable to query for S3 buckets: ' + helpers.addError(listBuckets));
            return callback(null, results, source);
        }

        if (!listBuckets.data.length) {
            helpers.addResult(results, 0, 'No S3 buckets to check');
            return callback(null, results, source);
        }

        listBuckets.data.forEach(function(bucket){
            var bucketLocation = helpers.getS3BucketLocation(cache, region, bucket.Name);

            if (ignoreEmptyBuckets){
                var listObjects = helpers.addSource(cache, source,
                    ['s3', 'listObjects', region, bucket.Name]);

                if (!listObjects || listObjects.err || !listObjects.data) {
                    helpers.addResult(results, 3,
                        'Unable to list S3 bucket objects: ' + helpers.addError(listObjects), bucketLocation, `arn:${awsOrGov}:s3:::` + bucket.Name);
                    return;
                }

                if (!listObjects.data.Contents || !listObjects.data.Contents.length){
                    helpers.addResult(results, 0,
                        'Bucket : ' + bucket.Name + ' is empty', bucketLocation, `arn:${awsOrGov}:s3:::` + bucket.Name);
                    return;
                }
            }

            var getBucketWebsite = helpers.addSource(cache, source,
                ['s3', 'getBucketWebsite', region, bucket.Name]);

            if (getBucketWebsite && getBucketWebsite.err &&
                getBucketWebsite.err.code && getBucketWebsite.err.code == 'NoSuchWebsiteConfiguration') {
                helpers.addResult(results, 0,
                    'Bucket : ' + bucket.Name + ' does not have static website hosting enabled',
                    bucketLocation, `arn:${awsOrGov}:s3:::` + bucket.Name);
            } else if (!getBucketWebsite || getBucketWebsite.err || !getBucketWebsite.data) {
                helpers.addResult(results, 3,
                    'Error querying bucket website for : ' + bucket.Name +
                    ': ' + helpers.addError(getBucketWebsite),
                    bucketLocation, `arn:${awsOrGov}:s3:::` + bucket.Name);
            } else if (Object.keys(getBucketWebsite.data).length) {
                helpers.addResult(results, 2,
                    'Bucket : ' + bucket.Name + ' has static website hosting enabled',
                    bucketLocation, `arn:${awsOrGov}:s3:::` + bucket.Name);
            } else {
                helpers.addResult(results, 0,
                    'Bucket : ' + bucket.Name + ' does not have static website hosting enabled',
                    bucketLocation, `arn:${awsOrGov}:s3:::` + bucket.Name);
            }
        });
        callback(null, results, source);
    }
};