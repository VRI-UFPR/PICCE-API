export const dbDefaults = {
    createdAt: expect.any(String),
    updateAt: expect.any(String),
};

export const addresses = [
    {
        original: {
            id: 1,
            city: 'New York',
            state: 'New York',
            country: 'United States',
        },
        updated: {
            city: 'Updated New York',
            state: 'New York',
            country: 'United States',
        },
    },
];
