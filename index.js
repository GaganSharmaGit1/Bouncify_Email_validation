import fs from 'fs';
import path from 'path';
import config from './config.js';
import getOutputPathFromArgs from './utils/readArgs/getOutputPathFromArgs.js';
import getInputFilePathFromArgs from './utils/readArgs/getInputFilePathFromArgs.js';
import saveInvalidJobIds from './utils/saveToFiles/saveInvalidJobIds.js';
import checkJobStatusById from './utils/jobIdsManagement/checkJobStatusById.js';
import downloadBouncifyEmailVerificationData from './utils/jobIdsManagement/downloadBouncifyEmailVerificationData.js';
import readCSVFile from './utils/readCSVfile/readCSVFile.js';
import { job_ids } from './utils/batchUpload/batchUploadEmailAddresses.js';
const outputPath =  getOutputPathFromArgs();

const main = async () => {
    try {
        const filePath = getInputFilePathFromArgs(); 
        const invalidJobIDs = [];
        console.log('File Path:', filePath);

        await readCSVFile(filePath).then(() => console.log('Processing completed!')).catch((err) => console.error('Error during CSV processing:', err));
        
        console.log('All batches uploaded! Now checking job status and downloading results...');
        console.log("Jobs:", job_ids);

        const jobStatus = job_ids.reduce((statusMap, id) => ({ ...statusMap, [id]: false }), {});

        while (Object.values(jobStatus).some(status => !status)) {
            await Promise.all(job_ids.map(async (id) => {
                if (jobStatus[id]) return; 

                const res = await checkJobStatusById(id);
                if(res === null){
                    console.log("Job not found for: ", id);
                    invalidJobIDs.push(id);
                    jobStatus[id] = true;
                } else if (res?.status === "completed") {
                    jobStatus[id] = true;
                    console.log(`Job completed for Job ID: ${id}. Downloading results...`);
                    await downloadBouncifyEmailVerificationData(id);
                } else if (res?.status === "cancelled") {
                    console.log(`Cancelled job for Job ID: ${id}. Exiting due to invalid data format`, res);
                    jobStatus[id] = true; 
                } else if (res?.status === "failed") {
                    console.log(`Unable to process job for Job ID: ${id}. The uploaded list contains invalid data`, res);
                    jobStatus[id] = true; 
                } else {
                    console.log(`Job still in progress for Job ID: ${id}, checking again in 5 seconds...`);
                }
            }));

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log("All jobs processed.");

        const INvalidJobs = path.join(`${outputPath}/${config.outputFolderName}`, config.invalidJobIds);
        if (!fs.existsSync(path.join(outputPath, config.outputFolderName))) {
            fs.mkdirSync(path.join(outputPath, config.outputFolderName), { recursive: true });
        }
        await saveInvalidJobIds(INvalidJobs, invalidJobIDs);

    } catch (err) {
        console.error("Error in main function:", err);
    }
};

await main();