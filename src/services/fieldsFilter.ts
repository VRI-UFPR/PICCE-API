/*
Copyright (C) 2024 Laboratorio Visao Robotica e Imagem
Departamento de Informatica - Universidade Federal do Parana - VRI/UFPR
This file is part of PICCE-API. PICCE-API is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
PICCE-API is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details. You should have received a copy
of the GNU General Public License along with PICCE-API.  If not, see <https://www.gnu.org/licenses/>
*/

export const fieldsFilter = (obj: any, filter: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (!filter || Object.keys(filter).length === 0) return obj;

    let result: any = Array.isArray(obj) ? [] : {};

    const applyFilter = (value: any, filterRule: any) =>
        Array.isArray(value) ? value.map((item) => fieldsFilter(item, filterRule)) : fieldsFilter(value, filterRule);

    if (filter.select) {
        for (const key in filter.select) {
            if (filter.select[key] === true && obj.hasOwnProperty(key)) {
                result[key] = obj[key];
            } else if (typeof filter.select[key] === 'object' && obj.hasOwnProperty(key)) {
                result[key] = applyFilter(obj[key], filter.select[key]);
            }
        }
    } else {
        result = Array.isArray(obj) ? [...obj] : { ...obj };
    }

    if (filter.include) {
        for (const key in filter.include) {
            if (filter.include[key] === true && obj.hasOwnProperty(key)) {
                result[key] = obj[key];
            } else if (typeof filter.include[key] === 'object' && obj.hasOwnProperty(key)) {
                result[key] = applyFilter(obj[key], filter.include[key]);
            }
        }
    }

    if (filter.omit) {
        for (const key in filter.omit) {
            if (filter.omit[key] === true && result.hasOwnProperty(key)) {
                delete result[key];
            } else if (typeof filter.omit[key] === 'object' && result.hasOwnProperty(key)) {
                result[key] = applyFilter(obj[key], filter.omit[key]);
            }
        }
    }

    return result;
};

export default fieldsFilter;
