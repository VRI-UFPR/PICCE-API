/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

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
