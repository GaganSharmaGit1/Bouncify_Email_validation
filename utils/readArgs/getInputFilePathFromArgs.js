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

export default getInputFilePathFromArgs;