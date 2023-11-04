export const errorFormatter = (error: any) => {
    const message = error.message.split('\n');
    return {
        message: message[message.length - 1].charAt(0).toUpperCase() + message[message.length - 1].slice(1),
        details: error,
    };
};

export default errorFormatter;
