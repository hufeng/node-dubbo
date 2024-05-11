

export class QpsCounter {
  /**
   * Memory counter for recording the number of requests per second.
   * By default, the memory only retains the data of the last 5 seconds.
   * E.g: {
   *   <second>: <counter>,
   *   '1715347076': 10,
   *   '1715347077': 10,
   *   '1715347078': 10,
   *   '1715347079': 20,
   *   '1715347080': 10
   * }
   * @private
   */
  private readonly counter: {
    [key: string]: number
  } = {};

  /**
   * for use with clearInterval
   * @private
   */
  private readonly intervalId: NodeJS.Timeout | number;

  constructor() {
    // Scheduled cleanup 5 seconds ago
    this.intervalId = setInterval(() => {
      // Clear the counter from 5 seconds ago
      const cs = this.currentSecond();
      Object.keys(this.counter).forEach(key => {
        if (Number(key) < cs - 5) {
          delete this.counter[key];
        }
      })
    }, 1000);
  }

  /**
   * Stop counter.
   */
  stop() {
    clearInterval(this.intervalId);
  }

  /**
   * Total number of seconds from 00:00:00 Greenwich Mean Time on January 1, 1970 to now
   */
  currentSecond() {
    return Math.floor(new Date().getTime()/1000);
  }

  /**
   * Returns the total number of requests in the last second
   */
  getQps() {
    const cs = this.currentSecond() - 1;
    if (this.counter[cs]) {
      return this.counter[cs];
    } else {
      return 0;
    }
  }

  /**
   * Record the number of requests
   */
  increment() {
    const cs = this.currentSecond();
    if (!this.counter[cs]) {
      this.counter[cs] = 1;
    } else {
      this.counter[cs]++;
    }
  }
}
