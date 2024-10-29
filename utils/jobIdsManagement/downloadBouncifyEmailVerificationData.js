
import axios from 'axios';
import config from '../../config.js';

import saveCompletedJobIds from '../saveToFiles/saveCompletedJobIds.js';
import saveBouncifyEmailVerificationResults from '../saveToFiles/saveBouncifyEmailVerificationResults.js';
let downloadedResponse;
const downloadBouncifyEmailVerificationData = async (id) => {
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
        await saveBouncifyEmailVerificationResults(downloadedResponse, id);
        await saveCompletedJobIds(id);
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
export default downloadBouncifyEmailVerificationData;