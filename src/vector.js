class Vector {
    /**
     * @constructor
     * @param {Number} size - Size of the vector (in bits)
     * @param {Buffer|Uint8Array} snapshot - Filter snapshot
     */
    constructor(size, snapshot = null) {
        this.bitLength = size
        this.byteLength = Math.ceil(size / 8)
        if (snapshot) {
            if (snapshot instanceof Buffer) {
                snapshot = snapshot.valueOf()
            }
            if (!(snapshot instanceof Uint8Array))
                throw new Error('Invalid filter data. UInt8Array expected.')
            this.value = snapshot
        } else {
            this.value = new Uint8Array(this.byteLength)
        }
    }

    /**
     * @type {Number} - Length in bits
     * @readonly
     */
    bitLength

    /**
     * @type {Number} - Length of the underlying buffer in bytes
     * @readonly
     */
    byteLength

    /**
     * @type {Uint8Array} - Underlying buffer
     * @private
     */
    value

    /**
     * Compute the number of set bits in the underlying vector
     * @return {Number}
     */
    get totalSetBits() {
        let res = 0
        for (let byte of this.value) {
            res += bitsLookup[byte]
        }
        return res
    }

    /**
     * Retrieve a bit value at the given position
     * @param {Number} position - Position index
     * @return {Boolean}
     */
    get(position) {
        return (this.value[(position / 8) | 0] & (1 << (position % 8))) > 0
    }

    /**
     * Set bit value at the given position
     * @param {Number} position - Position index
     * @param {Boolean} value - Value to set
     */
    set(position, value = true) {
        const remainder = position % 8
        const byteIndex = (position - remainder) / 8
        const mask = 1 << remainder
        //update byte in the buffer
        if (value) {
            this.value[byteIndex] |= mask
        } else {
            this.value[byteIndex] &= ~mask
        }
    }


    /**
     * Set a range of bits in one go
     * @param {Number} from - Start position (inclusive)
     * @param {Number} to - End position (exclusive)
     * @param {Boolean} value - Value to set
     */
    setRange(from, to, value = true) {
        let currIndex = -1
        let currValue
        for (let position = from; position < to; position++) {
            const remainder = position % 8
            const byteIndex = (position - remainder) / 8
            const mask = 1 << remainder

            if (byteIndex > currIndex) {
                //update current byte value in array
                if (currIndex >= 0) {
                    this.value[currIndex] = currValue
                }
                //move to the next byte
                currIndex = byteIndex
                currValue = this.value[currIndex]
            }
            //set/unset bit
            if (value) {
                currValue |= mask
            } else {
                currValue &= ~mask
            }
        }
        //write last processed byte
        this.value[currIndex] = currValue
    }

    /**
     * Check the equality of two vectors
     * @param {Vector} other - Other Vector instance
     * @return {Boolean}
     */
    equals(other) {
        if (!(other instanceof Vector))
            return false
        if (this.bitLength !== other.bitLength)
            return false

        const {value: currValue, byteLength} = this
        const {value: otherValue} = other
        for (let position = 0; position < byteLength; position++)
            if (currValue[position] !== otherValue[position])
                return false

        return true
    }

    /**
     * Create a copy (snapshot) of the underlying buffer
     * @return {Uint8Array}
     */
    snapshot() {
        return this.value.slice()
    }
}

//count bits in a byte helper
const bitsLookup = new Array(256)
//pre-fill lookup table
bitsLookup[0] = 0
for (let i = 0; i < 256; i++) {
    bitsLookup[i] = (i & 1) + bitsLookup[i / 2 | 0]
}

module.exports = Vector