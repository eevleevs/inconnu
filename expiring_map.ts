export class ExpiringMap extends Map {
  expiration
  
  constructor(expiration: number) {
    super()
    this.expiration = expiration
  }

  delete(key: any) {
    this.expire()
    return super.delete(key)
  }

  expire() {
    const now = Date.now()
    for (const [key,value] of this.entries()) 
      if (value[1] < now) super.delete(key)
      else break
    return this
  }
  
  get(key: any) {
    this.expire()
    return super.get(key)?.at(0)
  }

  getAndDelete(key: any) {
    const value = this.get(key)
    super.delete(key)
    return value
  }

  set(key: any, value: any) {
    super.delete(key)
    return super.set(key, [value, Date.now() + this.expiration])
  }
}