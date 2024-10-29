
import axios from 'axios';
import config from '../../config.js';

import saveAllCreatedJobId from '../saveToFiles/saveAllCreatedJobId.js';
export let job_ids = [];
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
        await saveAllCreatedJobId(jobId)
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


const batchUploadEmailAddresses = async (emails, batchSize) => {

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const EmailBatch = batch.map(email => ({ email }));
      console.log('Batch:', EmailBatch);
      const jobId = await uploadEmailBatch(EmailBatch);
    }
};

export default batchUploadEmailAddresses;