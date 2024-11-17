const amqp = require('amqplib');
const puppeteer = require('puppeteer');
const path = require('path');
const Redis = require('ioredis');

const RABBITMQ_URL = 'amqp://localhost';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

const redis = new Redis({
    host: '127.0.0.1',
    port: 6379
});

let channel;

// Initialize RabbitMQ
async function initRabbitMQ() {
    console.log('Connecting to RabbitMQ...');
    const connection = await amqp.connect(RABBITMQ_URL);
    console.log('Creating RabbitMQ channel...');
    channel = await connection.createChannel();
    console.log('Asserting screenshot_requests queue...');
    await channel.assertQueue('screenshot_requests');
    console.log('Worker connected to RabbitMQ');
}

// Process screenshot jobs
async function processJob(job) {
    console.log('Starting to process new job...');
    const jobData = JSON.parse(job.content.toString());
    
    // Validate required parameters
    if (!jobData.jobId || !jobData.url || !jobData.socketId) {
        console.log('Missing required parameters');
        channel.ack(job);
        return;
    }

    const { jobId, url, socketId } = jobData;

    console.log(jobId)
    
    // Set default viewport if not provided
    const viewport = jobData.viewport || {
        width: 1920,
        height: 1080
    };

    console.log(`Processing job: ${jobId} for URL: ${url}`);
    console.log(`Socket ID associated with job: ${socketId}`);
    console.log(`Viewport dimensions: ${viewport.width}x${viewport.height}`);

    const screenshotPath = path.join(SCREENSHOTS_DIR, `${jobId}.png`);
    console.log(`Screenshot will be saved to: ${screenshotPath}`);

    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({ headless: true });
        console.log('Creating new page...');
        const page = await browser.newPage();
        
        console.log('Setting viewport...');
        await page.setViewport({
            width: viewport.width,
            height: viewport.height
        });
        
        console.log(`Navigating to URL: ${url}`);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        } catch (error) {
            console.log('Website is down or unreachable');
            await browser.close();
            await redis.publish('screenshot-completion', JSON.stringify({
                socketId,
                jobId,
                screenshotURL: '',
                down: true
            }));
            return;
        }

        console.log('Taking screenshot...');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('Closing browser...');
        await browser.close();

        console.log(`Screenshot saved successfully to: ${screenshotPath}`);

        console.log('Publishing completion message to Redis...');
        await redis.publish('screenshot-completion', JSON.stringify({
            socketId,
            jobId,
            screenshotURL: `screenshots/${jobId}.png`,
            down: false
        }));



        await redis.set(`screenshot:${url}${viewport.height}x${viewport.width}`, JSON.stringify({
            screenshot: `screenshots/${jobId}.png` 
        }));


        console.log('Completion message published successfully');
    } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        console.log('Job processing failed');
        await redis.publish('screenshot-completion', JSON.stringify({
            socketId,
            jobId,
            screenshotURL: '',
            down: true
        }));

        // await redis.del(`screenshot:${url}${viewport}`);
       
    } finally {
        console.log('Acknowledging job completion to RabbitMQ');
        channel.ack(job);
    }
}

// Start worker
async function startWorker() {
    console.log('Starting worker...');
    await initRabbitMQ();

    console.log('Setting up job consumer...');
    channel.consume('screenshot_requests', async (job) => {
        console.log('Received new screenshot request');
        await processJob(job);
    });

    console.log('Worker initialized and listening for tasks');
}

console.log('Initializing screenshot worker service...');
startWorker().catch(error => {
    console.error('Fatal error in worker:', error);
});
