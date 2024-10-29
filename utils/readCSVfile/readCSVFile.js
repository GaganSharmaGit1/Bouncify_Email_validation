import fs from 'fs';
import csv from 'csv-parser';
import config from '../../config.js';
import saveCompletedJobIds from '../saveToFiles/saveCompletedJobIds.js';
import separateValidAndInvalidEmails from '../emailProcessing/separateValidAndInvalidEmails.js';
import batchUploadEmailAddresses from '../batchUpload/batchUploadEmailAddresses.js';
async function readCSVFile(filePath) {
    let emailArray = [];
    let emailBatch = [];
    let lineCounter = 0;
    const csvReadBatchSize = config.batchSize;

    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', async (row) => {
                const email = row['email'];
                if (email) {
                    emailArray.push(email);
                    lineCounter++;
                }

                if (lineCounter === csvReadBatchSize) {
                    fileStream.pause(); 
                    const res = await separateValidAndInvalidEmails(emailArray);
                    
                    for (const email of res) {
                        if (emailBatch.length < csvReadBatchSize) {
                            emailBatch.push(email);
                        } 
                        
                        if (emailBatch.length === csvReadBatchSize) {
                            console.log("EmailBatch ready for upload:", emailBatch);
                            await batchUploadEmailAddresses(emailBatch, csvReadBatchSize);
                            emailBatch = []; 
                        }
                    }
                    emailArray = []; 
                    lineCounter = 0; 
                    fileStream.resume(); 
                }
                
            })
            .on('end', async () => {
                try {
                    console.log("EmailArray: ", emailArray,emailArray.length,emailBatch)
                    if (emailArray.length > 0) {
                        const res = await separateValidAndInvalidEmails(emailArray);
                        console.log("Res: ", res);
                        for (const email of res) {
                            if (emailBatch.length < csvReadBatchSize) {
                                emailBatch.push(email);
                            }
                            if (emailBatch.length === csvReadBatchSize) {
                                console.log("EmailBatch ready for upload at last:", emailBatch);
                                await batchUploadEmailAddresses(emailBatch, csvReadBatchSize);
                                emailBatch = []; 
                            }
                        }
                    }
                    if (emailBatch.length > 0) {
                        console.log("EmailBatch ready for upload at end:", emailBatch);
                        await batchUploadEmailAddresses(emailBatch, csvReadBatchSize);
                        emailBatch = []; 
                    }

                    console.log('CSV file processed successfully.');
                    resolve();
                } catch (err) {
                    reject(`Error processing CSV file: ${err.message}`);
                }
            })
            .on('error', (err) => reject(`Error reading CSV file: ${err.message}`));
    });
}

export default readCSVFile;