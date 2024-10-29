import fs from 'fs';
import path from 'path';

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

export default saveInvalidJobIds;