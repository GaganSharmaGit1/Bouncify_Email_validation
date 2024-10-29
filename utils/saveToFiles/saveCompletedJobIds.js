import fs from 'fs';
import path from 'path';
import config from '../../config.js';

import getOutputPathFromArgs from '../readArgs/getOutputPathFromArgs.js';
const outputPath = getOutputPathFromArgs();
const saveCompletedJobIds = async (jobId) => {
    const jobIdFilePath = path.join(`${outputPath}/${config.outputFolderName}`, config.completedJobId );
    console.log('JobIDPATH',jobIdFilePath)
    const headersWritten = fs.existsSync(jobIdFilePath);
    
    if (!headersWritten) {
        fs.appendFileSync(jobIdFilePath, 'jobId\n', 'utf8');
    }

    fs.appendFile(jobIdFilePath, `${jobId}\n`, (err) => { 
        if (err) {
            console.error(`Error saving job ID to file: ${err.message}`);
        } else {
            console.log(`Job ID ${jobId} saved to ${jobIdFilePath}`);
        }
    });
};

export default saveCompletedJobIds;