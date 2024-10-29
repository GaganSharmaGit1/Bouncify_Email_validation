import fs from 'fs';
import path from 'path';
import config from '../../config.js';
import getOutputPathFromArgs from '../readArgs/getOutputPathFromArgs.js';
import blacklistDomains from '../../blacklistEmailDomains.js';
import saveEmailsToFile from '../saveToFiles/saveEmailsToFile.js';

const extractEmailDomain = async (email) => {
    const parts = email.split("@");
    return parts[1];
};
const createBlacklistDomainsSet = new Set(blacklistDomains);
const outputPath =  getOutputPathFromArgs();

const separateValidAndInvalidEmails = async (emails) => {
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
  export default separateValidAndInvalidEmails;