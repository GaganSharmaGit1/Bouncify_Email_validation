
import axios from 'axios';
import config from '../../config.js';

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
export default checkJobStatusById;