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

export default getOutputPathFromArgs;