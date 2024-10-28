import fs from 'fs';
import path from 'path';
import axios from 'axios';
import csv from 'csv-parser';
import config from './config.js';
import blacklistDomains from './blacklistEmailDomains.js'

const createBlacklistDomainsSet = new Set(blacklistDomains);
let job_ids = [];
let downloadedResponse;
const getOutputPathFromArgs = () => {
    const args = process.argv;
    const outputPathIndex = args.indexOf('-o') + 1;
    if (outputPathIndex > 0 && args[outputPathIndex]) {
        const outputPath = args[outputPathIndex];
        console.log('Output Path:', outputPath);
        return outputPath;  
    } else {
        throw new Error('Please provide an output path with the -o flag');
    }
};
const outputPath =  getOutputPathFromArgs();

const getInputFilePathFromArgs = () => {
    const args = process.argv;
    const filePathIndex = args.indexOf('-p') + 1;
    if (filePathIndex > 0 && args[filePathIndex]) {
        const jsonFilePath = args[filePathIndex];
        console.log('File Path:', jsonFilePath);
        return jsonFilePath;  
    } else {
        throw new Error('Please provide a file path with the -p flag');
    }
};

const saveEmailsToFile = async (filePath, emails) => {
    const outputDir = path.dirname(filePath);
    console.log("Output directory:", filePath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const data = emails.map(email => `${email.trim()}\n`).join('');
    const headersWritten = fs.existsSync(filePath);
    if (!headersWritten) {
        fs.writeFileSync(filePath, 'email\n', 'utf8');
    }
    fs.appendFile(filePath, data, (err) => {
        if (err) {
            console.error(`Error appending to file ${filePath}: ${err.message}`);
        } else {
            console.log(`Data appended to ${filePath}`);
        }
    });
};

const saveInvalidJobIds = async (filePath, emails) => {
    const outputDir = path.dirname(filePath);
    console.log("Output directory:", filePath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const data = emails.map(email => `${email.trim()}\n`).join('');
    const headersWritten = fs.existsSync(filePath);
    if (!headersWritten) {
        fs.writeFileSync(filePath, 'jobId\n', 'utf8');
    }
    fs.appendFile(filePath, data, (err) => {
        if (err) {
            console.error(`Error appending invlid job idsto file ${filePath}: ${err.message}`);
        } else {
            console.log(`invalid job ids appended to ${filePath}`);
        }
    });
};

const extractEmailDomain = async (email) => {
    const parts = email.split("@");
    return parts[1];
};

const validateDomainEmails = async (emails) => {
    const validEmails = [];
    const invalidEmails = [];
  
    await Promise.all(
      emails.map(async (email) => {
        const domain = await extractEmailDomain(email);
        if(domain && !createBlacklistDomainsSet.has(domain)) {
            validEmails.push(email);
        }
        else {
            invalidEmails.push(email);
        }
      })
    );
    const invalidEmailsFilePath = path.join(`${outputPath}/${config.outputFolderName}`, config.inValidEmailDomainFile);
    const validEmailsFilePath = path.join(`${outputPath}/${config.outputFolderName}`, config.validEmailDomainFile);
    
    if (!fs.existsSync(path.join(outputPath, config.outputFolderName))) {
        fs.mkdirSync(path.join(outputPath, config.outputFolderName), { recursive: true });
    }

    await saveEmailsToFile(invalidEmailsFilePath, invalidEmails);
    await saveEmailsToFile(validEmailsFilePath, validEmails);
    
    return validEmails;
  };

const saveJobId = async (jobId) => {
    const jobIdFilePath = path.join(`${outputPath}/${config.outputFolderName}`, config.jobIds );
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

const completedJobIds = async (jobId) => {
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

const uploadEmailBatch = async (batch) => {
    try {
        const response = await axios.post(`${config.apiUrl}/bulk`, {
            auto_verify: true,
            emails: batch
        }, {
            params: {
                apikey: config.apikey
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log("Uploaded batch:", batch);
        const jobId = response?.data?.job_id;
        job_ids.push(jobId);
        await saveJobId(jobId)
        console.log("JOBID",jobId)
    } catch (err) {
        if (err.response) {
            if (err.response.status === 401) {
                console.error("Unauthorized: Invalid API key. Please check your API key and try again.");
                throw new Error("Unauthorized: Invalid API key");
            } else if (err.response.status === 400) {
                console.error("Bad Request: Invalid file data. Please check the file format and content.");
                throw new Error("Bad Request: Invalid file data");
            }
        } else {
            console.error("Error uploading batch:", err);
        }
    }
};

const saveEmailVerificationResults = async (data, jobId) => {
    const results = [];
    const outputDir = path.join(outputPath, config.outputFolderName); 

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true }); 
    }

    data.split('\n').forEach((row, index) => {
        if (index === 0 || !row.trim()) return;
        const columns = row.split(',').map(col => col.replace(/"/g, '').trim());

        const email = columns[0];
        const verificationResult = columns[1];
        const verifiedAt = columns[2];
        const syntaxError = columns[3]; 
        const isp = columns[4];
        const role = columns[5]; 
        const disposable = columns[6];
        const trap = columns[7];

        results.push({
            jobId: jobId,
            email: email,
            verificationResult: verificationResult,
            verifiedAt: verifiedAt,
            syntaxError: syntaxError,
            isp: isp,
            role: role,
            disposable: disposable,
            trap: trap
        });
    });

    results.forEach(row => {
        let filePath;
        if (row.verificationResult === 'deliverable') {
            filePath = path.join(outputDir, config.validEmails);
        } else if (row.verificationResult === 'undeliverable') {
            filePath = path.join(outputDir, config.invalidEmails);
        } else if (row.verificationResult === 'accept-all') {
            filePath = path.join(outputDir, config.acceptAll);
        } else if (row.verificationResult === 'unknown') {
            filePath = path.join(outputDir, config.unknown);
        }

        if (filePath) {
            const headersWritten = fs.existsSync(filePath);
            const headerLine = 'jobId,email,verificationResult,verifiedAt,syntaxError,isp,role,disposable,trap\n';

            if (!headersWritten || fs.readFileSync(filePath, 'utf8').indexOf('jobId') === -1) {
                fs.writeFileSync(filePath, headerLine, 'utf8'); 
            }

            fs.appendFileSync(filePath, `${row.jobId},${row.email},${row.verificationResult},${row.verifiedAt},${row.syntaxError},${row.isp},${row.role},${row.disposable},${row.trap}\n`, 'utf8');
            console.log(`Written ${row.email} to ${filePath}`);
        }
    });
};

const getEmailResults = async (id) => {
    try {
        const downloadResponse = await axios.post(
            `${config.apiUrl}/download?jobId=${id}&apikey=${config.apikey}`,
            {
                filterResult: ['deliverable', 'undeliverable', 'accept_all', 'unknown']
            },
            {
                headers: {
                    'Accept': 'text/plain',
                    'Content-Type': 'application/json'
                }
            }
        );

        downloadedResponse = downloadResponse?.data;
        await saveEmailVerificationResults(downloadedResponse, id);
        await completedJobIds(id);
    } catch (err) {
        if (err.response) {
            switch (err.response.status) {
                case 401:
                    console.error("Unauthorized: Invalid API Key. Please check your API key.");
                    break;
                case 400:
                    const errorMessage = err.response.data.result;
                    if (errorMessage.includes("Job not found")) {
                        console.error("Error: Job not found. Invalid jobId.");
                    } else if (errorMessage.includes("DOWNLOAD-RESTRICTED")) {
                        console.error("Error: Download restricted. Please check your permissions.");
                    } else if (errorMessage.includes("Invalid filterResult")) {
                        console.error("Error: Invalid filterResult. Please provide correct filterResult options.");
                    } else if (errorMessage.includes("Job is being verified")) {
                        console.error("Error: Job is being verified, please wait until it completes.");
                    } else if (errorMessage.includes("Job is ready for verification")) {
                        console.error("Error: Job is ready for verification, please start verification and download your results once list verified.");
                    } else {
                        console.error("Error: Bad Request -", errorMessage);
                    }
                    break;
                default:
                    console.error("Error downloading results:", err.message);
            }
        } else {
            console.error("Error downloading results:", err.message);
        }
    }
};

const checkJobStatusById = async (jobId) => {
    console.log(`Checking Job Status for Job ID: ${jobId}`);
    try {
        const res = await axios.get(`${config.apiUrl}/bulk/${jobId}?apikey=${config.apikey}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        console.log("Job id response:", res.data.message);
        return res.data;
    } catch (err) {
        if (err.response) {
            if (err.response.status === 401) {
                console.error("Error checking job status for Job ID:", jobId, "- Unauthorized: Invalid API Key");
            } else if (err.response.status === 400 && err.response.data.result === "Job not found. Invalid jobId") {
                console.error(`Error checking job status for Job ID: ${jobId} - Job not found. Invalid jobId`);
            } else {
                console.error("Error checking job status for Job ID:", err.response.data);
            }
        } else {
            console.error("Error checking job status for Job ID:", err.message);
        }
        return null;
    }
};

const batchUploadEmailAddresses = async (emails, batchSize) => {

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const EmailBatch = batch.map(email => ({ email }));
      console.log('Batch:', EmailBatch);
      const jobId = await uploadEmailBatch(EmailBatch);
    }
};
 
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
                    const res = await validateDomainEmails(emailArray);
                    
                    for (const email of res) {
                        if (emailBatch.length < csvReadBatchSize) {
                            emailBatch.push(email);
                        } 
                        
                        if (emailBatch.length === csvReadBatchSize) {
                            console.log("EmailBatch ready for upload:", emailBatch);
                            // const jobId = await uploadEmailBatch(emailBatch); 
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
                        const res = await validateDomainEmails(emailArray);
                        console.log("Res: ", res);
                        for (const email of res) {
                            if (emailBatch.length < csvReadBatchSize) {
                                emailBatch.push(email);
                            }
                            if (emailBatch.length === csvReadBatchSize) {
                                console.log("EmailBatch ready for upload at last:", emailBatch);
                                await batchUploadEmailAddresses(emailBatch, csvReadBatchSize);

                                // const jobId = await uploadEmailBatch(emailBatch); 
                                emailBatch = []; 
                            }
                        }
                    }
                    if (emailBatch.length > 0) {
                        console.log("EmailBatch ready for upload at end:", emailBatch);
                        // const jobId = await uploadEmailBatch(emailBatch);
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

const main = async () => {
    try {
        const filePath = getInputFilePathFromArgs(); 
        const INvalidJobIDs = [];
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
                    INvalidJobIDs.push(id);
                    jobStatus[id] = true;
                } else if (res?.status === "completed") {
                    jobStatus[id] = true;
                    console.log(`Job completed for Job ID: ${id}. Downloading results...`);
                    await getEmailResults(id);
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
        await saveInvalidJobIds(INvalidJobs, INvalidJobIDs);

    } catch (err) {
        console.error("Error in main function:", err);
    }
};

await main();