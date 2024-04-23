export default function anyTrue (object) {
    return Object.keys(object).some(key => !!object[key]);
}
