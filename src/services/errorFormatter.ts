export const errorFormatter = (error: any) => {
    const message = error.message.split('\n');
    return {
        message: message[message.length - 1].charAt(0).toUpperCase() + message[message.length - 1].slice(1),
        details: error,
    };
};

export const errorFormatterMiddleware = (error: any, req: any, res: any, next: any) => {
    const formattedError = errorFormatter(error);
    res.status(error.status || 500).json(formattedError);
};

export default errorFormatter;
