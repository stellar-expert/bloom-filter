const {h64} = require('xxhashjs')
const Vector = require('./vector')

class BloomFilter {
    /**
     * @param {Number} sizeInBits - Filter size in bits
     * @param {Number} numHashFunctions - Number of hash functions to apply
     * @param {Uint8Array} snapshot - Previously created filter snapshot
     * @param {Number} seed? - Seed for usage with hash functions
     * @constructor
     */
    constructor(sizeInBits, numHashFunctions, snapshot, seed = 0x7e53a269) {
        if (sizeInBits % 8 !== 0)
            throw new Error('Invalid Bloom filter size')
        this.sizeInBits = sizeInBits
        this.k = numHashFunctions
        this.seed = seed
        if (snapshot) {
            if (!(snapshot instanceof Uint8Array))
                throw new TypeError('Invalid Bloom filter snapshot format')
            if (snapshot.length * 8 !== sizeInBits)
                throw new Error('Mismatched Bloom filter size for a given snapshot')
            this.vector = new Vector(this.sizeInBits, snapshot)
        } else {
            //init with new empty vector
            this.vector = new Vector(this.sizeInBits)
        }
    }

    /**
     * @type {Number} - Filter size in bits
     * @readonly
     */
    sizeInBits

    /**
     * @type {Number} - Number of hash functions to calculate for every item
     * @readonly
     */
    k

    /**
     * @type {Vector} - Underlying data
     * @readonly
     * @private
     */
    vector

    /**
     * @type {Number} - Seed for usage with hash functions
     * @readonly
     * @private
     */
    seed

    /**
     * Add an item to the filter
     * @param {String} item - An item to add
     */
    add(item) {
        const mask = this.computeMask(item)
        for (const position of mask) {
            this.vector.set(position, true)
        }
    }

    /**
     * Check whether the key is (probably) stored in the filter
     * @param {String} item - Item to look for
     * @return {Boolean}
     */
    contains(item) {
        const mask = this.computeMask(item)
        for (const position of mask)
            if (!this.vector.get(position))
                return false
        return true
    }

    /**
     * Create a snapshot of the current state of the filter
     * @return {Uint8Array}
     */
    snapshot() {
        return this.vector.snapshot()
    }

    /**
     * Estimate potential false-positive probability for this filter (in percents)
     * @returns {Number}
     */
    estimateFalsePositives() {
        return ((this.vector.totalSetBits / this.sizeInBits) ** this.k) * 100
    }

    /**
     * Compute hash mask for the given item
     * @param {String} item - Item to process
     * @return {[]}
     * @private
     */
    computeMask(item) {
        //calculate 64-bit hash
        const hash = h64(item, this.seed)
        //split into two 32-bit parts
        const low = hash._a16 * 65536 + hash._a00
        const high = hash._a48 * 65536 + hash._a32
        //generate k pseudo-hashes
        const {k} = this
        const res = new Array(k)
        for (let i = 0; i < k; i++) {
            res[i] = (low + i * high) % this.sizeInBits
        }
        return res
    }

    /**
     * Calculate rough estimate of false positive result for given hash size and number of applied hash functions
     * @param {Number} sizeInBits - Filter size (in bits)
     * @param {Number} numberOfHashFunctions - Number of hash functions to apply
     * @param {Number} estimatedItemsCount - Total number of items in the filter
     * @return {Number} - False positive probability (fraction between 0 and 1)
     */
    static estimateFalsePositiveProbability(sizeInBits, numberOfHashFunctions, estimatedItemsCount) {
        //p = pow(1 - exp(-k / (m / n)), k)   https://hur.st/bloomfilter/
        return Math.pow(1 - Math.exp(-numberOfHashFunctions / (sizeInBits / estimatedItemsCount)), numberOfHashFunctions)
    }

    /**
     * Estimate maximum allowed capacity for given filter size and acceptable false positive probability rate
     * @param {Number} sizeInBits - Filter size (in bits)
     * @param {Number} numberOfHashFunctions - Number of hash functions to apply
     * @param {Number} maxAllowedFalsePositiveProbability - Acceptable false positive probability (fraction between 0 and 1)
     * @return {Number} - Maximum items in the filter for given filter params
     */
    static estimateMaximumCapacity(sizeInBits, numberOfHashFunctions, maxAllowedFalsePositiveProbability) {
        //n = ceil(m / (-k / log(1 - exp(log(p) / k))))   https://hur.st/bloomfilter/
        return Math.ceil(sizeInBits / (-numberOfHashFunctions / Math.log(1 - Math.exp(Math.log(maxAllowedFalsePositiveProbability) / numberOfHashFunctions))))
    }
}

module.exports = BloomFilter