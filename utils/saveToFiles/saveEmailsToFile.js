import fs from 'fs';
import path from 'path';

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

export default saveEmailsToFile;