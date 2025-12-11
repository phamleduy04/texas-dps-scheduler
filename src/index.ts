import TexasScheduler from './Client';
import * as log from './Log';

const scheduler = new TexasScheduler();
scheduler.start().catch((err: Error) => {
    log.error('Unhandled error in TexasScheduler', err);
    process.exit(1);
});
