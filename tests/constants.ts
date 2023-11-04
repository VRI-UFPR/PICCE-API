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

export const applicationAnswers = [
    {
        original: {
            id: 1,
            date: '2021-01-01T03:00:00.000Z',
            userId: 1,
            applicationId: 1,
            addressId: 1,
            itemAnswerGroups: [
                {
                    id: 1,
                    itemAnswers: [
                        {
                            id: 1,
                            text: 'Item answer 1',
                            itemId: 1,
                        },
                    ],
                    optionAnswers: [
                        {
                            id: 1,
                            text: 'Option answer 1',
                            itemId: 1,
                            optionId: 1,
                        },
                    ],
                    tableAnswers: [
                        {
                            id: 1,
                            text: 'Table answer 1',
                            itemId: 1,
                            columnId: 1,
                        },
                    ],
                },
            ],
        },
        updated: {
            date: '2021-03-01T03:00:00.000Z',
            addressId: 1,
            itemAnswerGroups: [
                {
                    id: 1,
                    itemAnswers: [
                        {
                            id: 1,
                            text: 'Updated item answer 1',
                        },
                    ],
                    optionAnswers: [
                        {
                            id: 1,
                            text: 'Updated option answer 1',
                        },
                    ],
                    tableAnswers: [
                        {
                            id: 1,
                            text: 'Updated table answer 1',
                        },
                    ],
                },
            ],
        },
    },
];
