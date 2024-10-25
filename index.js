import fs from 'fs';
import path from 'path';
import axios from 'axios';
import csv from 'csv-parser';
import config from './config.js';
import blacklistDomains from './blacklistEmailDomains.js'

const blacklistSet = new Set(blacklistDomains);

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

const appendEmailsToFile = async (filePath, emails) => {
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


const extractDomainFromEmail = async (email) => {
    const parts = email.split("@");
    console.log("Domain & email", email, parts, parts[1])
    return parts[1];
  };
const validateDomainEmails = async (emails) => {
    const validEmails = [];
    const invalidEmails = [];
  
    await Promise.all(
      emails.map(async (email) => {
        const domain = await extractDomainFromEmail(email);
        if(domain && !blacklistSet.has(domain)) {
            validEmails.push(email);
        }
        else {
            invalidEmails.push(email);
        }
      })
    );
    const outputPath = getOutputPathFromArgs();
    const invalidEmailsFilePath = path.join(`${outputPath}/${config.outputFolderName}`, config.inValidEmailDomainFile);
    const validEmailsFilePath = path.join(`${outputPath}/${config.outputFolderName}`, config.validEmailDomainFile);
    
    if (!fs.existsSync(path.join(outputPath, config.outputFolderName))) {
        fs.mkdirSync(path.join(outputPath, config.outputFolderName), { recursive: true });
    }

    await appendEmailsToFile(invalidEmailsFilePath, invalidEmails);
    await appendEmailsToFile(validEmailsFilePath, validEmails);
    
    return validEmails;
  };


const saveJobIdToFile = async (jobId) => {
    const outputPath =  getOutputPathFromArgs();
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
const completedJobs = async (jobId) => {
    const outputPath = getOutputPathFromArgs();
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
        await saveJobIdToFile(jobId)
        console.log("JOBID",jobId)
    } catch (err) {
        console.error("Error uploading batch:", err);
    }
};

const downloadEmailResults = async (id) => {
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
        await writeResultsToCSV(downloadedResponse, id);
        await completedJobs(id);
    } catch (err) {
        console.error("Error downloading results:", err);
    }
};



const writeResultsToCSV = async (data, jobId) => {
    const results = [];
    const outputPath = getOutputPathFromArgs();

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
            filePath = path.join(outputDir, 'validEmails.csv');
        } else if (row.verificationResult === 'undeliverable') {
            filePath = path.join(outputDir, 'invalidEmails.csv');
        } else if (row.verificationResult === 'accept-all') {
            filePath = path.join(outputDir, 'acceptAll.csv');
        } else if (row.verificationResult === 'unknown') {
            filePath = path.join(outputDir, 'unknown.csv');
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
        console.error("Error checking job status for Job ID:", err.data);
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
 
async function processCSV(filePath) {
    const emailArray = [];
    console.log('EmailArray',emailArray);

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                const email = row['email'];
                if (email) {
                    emailArray.push(email);
                }
            })
            .on('end', async () => {
                try {
                    for (let i = 0; i < emailArray.length; i += config.batchSize) {
                        const batch = emailArray.slice(i, i + config.batchSize);
                        // console.log("Batches array", batch)
                        const res = await validateDomainEmails(batch);
                        // await batchUploadEmailAddresses(res, config.batchSize);
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
    console.log("called main()");
    const filePath = getInputFilePathFromArgs(); 
    try {
        const INvalidJobIDs = [];
        console.log('File Path:', filePath);

        await processCSV(filePath).then(() => console.log('Processing completed!')).catch((err) => console.error('Error during CSV processing:', err));
        
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
                    await downloadEmailResults(id);
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
        const outputPath = getOutputPathFromArgs();
        const INvalidJobs = path.join(`${outputPath}/${config.outputFolderName}`, config.invalidJobIds);
        if (!fs.existsSync(path.join(outputPath, config.outputFolderName))) {
            fs.mkdirSync(path.join(outputPath, config.outputFolderName), { recursive: true });
        }
        await appendEmailsToFile(INvalidJobs, INvalidJobIDs);

    } catch (err) {
        console.error("Error in main function:", err);
    }
};


await main();
