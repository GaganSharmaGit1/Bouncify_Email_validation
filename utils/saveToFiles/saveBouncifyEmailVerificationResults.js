import fs from 'fs';
import path from 'path';
import config from '../../config.js';

import getOutputPathFromArgs from '../readArgs/getOutputPathFromArgs.js';

const outputPath = getOutputPathFromArgs();
const saveBouncifyEmailVerificationResults = async (data, jobId) => {
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

export default saveBouncifyEmailVerificationResults;