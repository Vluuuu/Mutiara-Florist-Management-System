import Alpine from 'alpinejs';

Alpine.data('orderForm', (initialItems = []) => {
    const blankItem = () => ({
        id: null,
        flower_type: '',
        recipient: '',
        sender_name: '',
        delivery_date: '',
        delivery_location: '',
        quantity: 1,
        unit_price: 0,
        shipping_mode: 'INCLUDED',
        shipping_fee: 0,
        fulfillment_status: 'NEW',
        notes: '',
    });

    let nextKey = 0;
    const seeds = Array.isArray(initialItems) && initialItems.length ? initialItems : [blankItem()];

    return {
        items: seeds.map((item) => ({ ...blankItem(), ...item, _key: ++nextKey, _initialStatus: item.fulfillment_status || 'NEW' })),
        addItem() {
            if (this.items.length >= 20) return;
            this.items.push({ ...blankItem(), _key: ++nextKey, _initialStatus: 'NEW' });
        },
        removeItem(index) {
            if (this.items.length > 1) this.items.splice(index, 1);
        },
        shippingChanged(item) {
            if (item.shipping_mode === 'INCLUDED') item.shipping_fee = 0;
        },
        allowedStatuses(item) {
            const steps = [
                { value: 'NEW', label: 'Baru' },
                { value: 'PROCESSING', label: 'Diproses' },
                { value: 'READY', label: 'Siap kirim' },
                { value: 'DELIVERED', label: 'Terkirim' },
            ];
            const index = Math.max(steps.findIndex((step) => step.value === item._initialStatus), 0);
            return steps.slice(index, Math.min(index + 2, steps.length));
        },
        asInt(value) {
            const result = Number(value);
            return Number.isSafeInteger(result) && result >= 0 ? result : 0;
        },
        productTotal() {
            return this.items.reduce((total, item) => total + this.asInt(item.quantity) * this.asInt(item.unit_price), 0);
        },
        shippingTotal() {
            return this.items.reduce((total, item) => total + (item.shipping_mode === 'SEPARATE' ? this.asInt(item.shipping_fee) : 0), 0);
        },
        money(amount) {
            return 'Rp' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount);
        },
    };
});

window.Alpine = Alpine;
Alpine.start();
