import { Item, TradingConfig, ProfitAnalysis } from "../types/TradingTypes";
import { Logger } from "../../shared/logging/Logger";

export class ProfitCalculator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger("ProfitCalculator");
  }

  public calculateSimpleProfit(item: Item): number {
    return item.resalePrice - item.purchasePrice;
  }

  public calculateProfitWithFees(item: Item, config: TradingConfig): number {
    let profit = this.calculateSimpleProfit(item);

    if (config.includeFees) {
      const fees = this.calculateFees(item.resalePrice, config);
      profit -= fees;
    }

    return profit;
  }

  public calculateProfitPercentage(item: Item): number {
    if (item.purchasePrice === 0) {
      return 0;
    }
    return ((item.resalePrice - item.purchasePrice) / item.purchasePrice) * 100;
  }

  public calculateProfitPercentageWithFees(
    item: Item,
    config: TradingConfig,
  ): number {
    if (item.purchasePrice === 0) {
      return 0;
    }

    const profitWithFees = this.calculateProfitWithFees(item, config);
    return (profitWithFees / item.purchasePrice) * 100;
  }

  public calculateFees(price: number, config: TradingConfig): number {
    let fees = 0;

    if (config.feePercentage !== undefined) {
      fees += (price * config.feePercentage) / 100;
    }

    if (config.feesFixed !== undefined) {
      fees += config.feesFixed;
    }

    return fees;
  }

  public analyze(item: Item, config: TradingConfig): ProfitAnalysis {
    const simpleProfit = this.calculateSimpleProfit(item);
    const profitPercentage = this.calculateProfitPercentage(item);
    const profitPerUnit =
      item.quantity > 0 ? simpleProfit / item.quantity : simpleProfit;

    const fees = config.includeFees
      ? this.calculateFees(item.resalePrice, config)
      : 0;
    const netProfit = simpleProfit - fees;
    const netProfitPercentage =
      item.purchasePrice === 0 ? 0 : (netProfit / item.purchasePrice) * 100;

    const passesThreshold = this.checkThreshold(netProfit, config);

    const isMarginal = netProfitPercentage < 10;
    const isHighVolume = item.quantity > 100;
    const isLowVolume = item.quantity < 10;

    const analysis: ProfitAnalysis = {
      itemId: item.id,
      itemName: item.name,
      purchasePrice: item.purchasePrice,
      resalePrice: item.resalePrice,
      profitAmount: simpleProfit,
      profitPercentage,
      profitPerUnit,
      passesThreshold,
      fees,
      netProfit,
      netProfitPercentage,
      analysis: {
        marginal: isMarginal,
        highVolume: isHighVolume,
        lowVolume: isLowVolume,
      },
      timestamp: Date.now(),
    };

    return analysis;
  }

  private checkThreshold(profit: number, config: TradingConfig): boolean {
    if (profit < config.minProfitThreshold) {
      return false;
    }

    if (
      config.maxProfitThreshold !== undefined &&
      profit > config.maxProfitThreshold
    ) {
      return false;
    }

    return true;
  }

  public calculateROI(investment: number, profit: number): number {
    if (investment === 0) {
      return 0;
    }
    return (profit / investment) * 100;
  }

  public estimateTotalProfit(items: Item[], config: TradingConfig): number {
    return items.reduce((total, item) => {
      return total + this.calculateProfitWithFees(item, config);
    }, 0);
  }

  public filterProfitable(items: Item[], config: TradingConfig): Item[] {
    return items.filter((item) => {
      const profit = this.calculateProfitWithFees(item, config);
      return this.checkThreshold(profit, config);
    });
  }
}
