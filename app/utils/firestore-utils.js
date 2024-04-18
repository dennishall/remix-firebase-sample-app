/*
// currently unused
export function jsonToDocument (value) {
    if (!isNaN(value)) {
        if (value.toString().indexOf('.') !== -1)
            return { 'doubleValue': value };
        else
            return { 'integerValue': value };
    } else if (value === 'true' || value === 'false' || typeof value == 'boolean') {
        return { 'booleanValue': value };
    } else if (Date.parse(value)) {
        return { 'timestampValue': value };
    } else if (typeof value == 'string') {
        return { 'stringValue': value };
    } else if (value && value.constructor === Array) {
        return { 'arrayValue': { values: value.map(v => jsonToDocument(v)) } };
    } else if (typeof value === 'object') {
        const fields = {};
        Object.keys(value).forEach(key => {
            fields[key] = jsonToDocument(value[key]);
        });
        return { 'mapValue': { fields } };
    }
}
 */
export function documentToJson (fields) {
    const result = {};
    Object.keys(fields).forEach(key => {
        const value = fields[key];
        if (key === 'stringValue') {
            return value;
        }
        if (key === 'booleanValue') {
            return typeof value === 'boolean' ? value : value === 'true';
        }
        if (key === 'doubleValue' || key === 'integerValue') {
            return +value;
        }
        if (key === 'timestampValue') {
            return new Date(value);
        }
        if (key === 'mapValue') {
            return documentToJson(value.fields || {});
        }
        if (key === 'arrayValue') {
            const list = value.values;
            return !!list ? list.map(l => documentToJson(l)) : [];
        }
        result[key] = documentToJson(value)
    });
    return result;
}
// examples
// const documentData = { "list1": { "arrayValue": { "values": [{ "stringValue": "item1" }, { "stringValue": "item2" }] } } }
// const jsonData = documentToJson(documentData);
// const documentData1 = jsonToDocument(jsonData).mapValue.fields;
// console.log(JSON.stringify(documentData));
// console.log(JSON.stringify(jsonData));
// console.log(JSON.stringify(documentData1));
