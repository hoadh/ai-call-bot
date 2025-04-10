
// Get customer information by phone number from API
export async function getCustomerInfo(phoneNumber) {
    const url =`${process.env.INTERNAL_BACKEND_API_URL}/customers/phone/${phoneNumber}`;
    console.log("Fetching customer info from:", url);
    const response = await fetch(url);
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    //console.log('Response body:', await response.text());
    // Check if the response is ok (status code 200-299)

    if (response.status === 404) {
        console.log('Customer not found');
        return null;
    }
    if (response.status === 500) {
        console.error('Internal server error');
        throw new Error('Internal server error');
    }

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    console.log('Customer data:', data);
    return data;
}