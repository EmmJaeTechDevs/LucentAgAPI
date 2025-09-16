import type { DeliveryFeeRequest } from "@shared/schema";

interface DeliveryFeeResponse {
  deliveryFee: number; // Fee in cents
  distance: number; // Distance in kilometers  
  estimatedDuration: string;
  provider: string;
}

interface DeliveryProvider {
  name: string;
  calculateFee(request: DeliveryFeeRequest): Promise<DeliveryFeeResponse>;
}

// Mock Nigerian Logistics Provider
class MockNigerianLogistics implements DeliveryProvider {
  name = "Nigerian Express Logistics";

  async calculateFee(request: DeliveryFeeRequest): Promise<DeliveryFeeResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Calculate based on distance estimation and weight
    const distance = this.estimateDistance(
      request.fromState, request.fromLga,
      request.toState, request.toLga
    );

    // Base rate: ₦100 per km, plus ₦50 per kg/unit
    const baseRate = distance * 100; // ₦1 per km
    const weightRate = this.calculateWeight(request) * 50; // ₦0.5 per kg
    const deliveryFee = Math.round((baseRate + weightRate) * 100); // Convert to cents

    // Estimate duration based on distance
    let estimatedDuration: string;
    if (distance <= 50) {
      estimatedDuration = "1-2 business days";
    } else if (distance <= 150) {
      estimatedDuration = "2-3 business days"; 
    } else if (distance <= 300) {
      estimatedDuration = "3-5 business days";
    } else {
      estimatedDuration = "5-7 business days";
    }

    return {
      deliveryFee,
      distance,
      estimatedDuration,
      provider: this.name
    };
  }

  private estimateDistance(fromState: string, fromLga: string, toState: string, toLga: string): number {
    // Simple distance estimation based on Nigerian states
    // In production, this would use Google Maps Distance Matrix API
    const stateDistances: Record<string, Record<string, number>> = {
      'Lagos': {
        'Lagos': 25,
        'Ogun': 50,
        'Oyo': 120,
        'Osun': 180,
        'Ondo': 200,
        'Ekiti': 220,
        'Kwara': 300,
        'Kogi': 350,
        'Niger': 400,
        'FCT': 450,
        'Kaduna': 600,
        'Kano': 800
      },
      'Ogun': {
        'Lagos': 50,
        'Ogun': 30,
        'Oyo': 100,
        'Osun': 150,
        'Ondo': 180,
        'Ekiti': 200
      },
      'Oyo': {
        'Lagos': 120,
        'Ogun': 100,
        'Oyo': 40,
        'Osun': 80,
        'Kwara': 120,
        'Niger': 250
      }
    };

    // Default distances for states not in the matrix
    const defaultDistance = 200;

    const distance = stateDistances[fromState]?.[toState] || 
                    stateDistances[toState]?.[fromState] ||
                    defaultDistance;

    // Add some variation based on LGA (±20%)
    const variation = (Math.random() - 0.5) * 0.4 + 1; // 0.8 to 1.2
    return Math.round(distance * variation);
  }

  private calculateWeight(request: DeliveryFeeRequest): number {
    // Convert different units to approximate weight in kg
    const unitWeights = {
      'kg': request.weight,
      'bags': request.weight * 50, // Assume 50kg per bag for grains
      'baskets': request.weight * 25 // Assume 25kg per basket
    };

    return unitWeights[request.unit] * request.quantity;
  }
}

// Google Maps Distance Matrix integration (for production)
class GoogleMapsDeliveryService implements DeliveryProvider {
  name = "Google Maps Delivery Calculator";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';
  }

  async calculateFee(request: DeliveryFeeRequest): Promise<DeliveryFeeResponse> {
    if (!this.apiKey) {
      throw new Error("Google Maps API key not configured");
    }

    try {
      // In production, implement actual Google Maps Distance Matrix API call
      const origin = `${request.fromLga}, ${request.fromState}, Nigeria`;
      const destination = `${request.toLga}, ${request.toState}, Nigeria`;
      
      // Mock response for now
      const mockDistance = Math.floor(Math.random() * 500 + 50);
      const weight = this.calculateWeight(request);
      
      // Nigerian logistics pricing: Base rate + distance rate + weight rate
      const baseRate = 2000; // ₙ20 base fee
      const distanceRate = mockDistance * 15; // ₙ0.15 per km
      const weightRate = weight * 5; // ₙ0.05 per kg
      const deliveryFee = baseRate + distanceRate + weightRate;

      return {
        deliveryFee: Math.round(deliveryFee * 100), // Convert to cents
        distance: mockDistance,
        estimatedDuration: this.calculateDuration(mockDistance),
        provider: this.name
      };
    } catch (error) {
      console.error('Google Maps API error:', error);
      // Fallback to mock calculation
      const mockProvider = new MockNigerianLogistics();
      return mockProvider.calculateFee(request);
    }
  }

  private calculateWeight(request: DeliveryFeeRequest): number {
    const unitWeights = {
      'kg': request.weight,
      'bags': request.weight * 50,
      'baskets': request.weight * 25
    };
    return unitWeights[request.unit] * request.quantity;
  }

  private calculateDuration(distance: number): string {
    if (distance <= 50) return "Same day - 1 business day";
    if (distance <= 100) return "1-2 business days";
    if (distance <= 200) return "2-3 business days";
    if (distance <= 400) return "3-5 business days";
    return "5-7 business days";
  }
}

// Third-party Nigerian logistics providers
class GIGLogistics implements DeliveryProvider {
  name = "GIG Logistics";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GIG_LOGISTICS_API_KEY || '';
  }

  async calculateFee(request: DeliveryFeeRequest): Promise<DeliveryFeeResponse> {
    // In production, integrate with GIG Logistics API
    // For now, use enhanced mock calculation
    
    const distance = this.estimateDistanceAdvanced(request);
    const weight = this.calculateWeight(request);
    
    // GIG Logistics pricing structure
    const baseFee = 1500; // ₦15 base
    const distanceFee = distance * 12; // ₦0.12 per km  
    const weightFee = Math.max(weight - 5, 0) * 8; // Free first 5kg, then ₦0.08/kg
    
    const totalFee = baseFee + distanceFee + weightFee;

    return {
      deliveryFee: Math.round(totalFee * 100), // Convert to cents
      distance: Math.round(distance),
      estimatedDuration: this.calculateDuration(distance),
      provider: this.name
    };
  }

  private estimateDistanceAdvanced(request: DeliveryFeeRequest): number {
    // More sophisticated distance calculation
    const stateCoordinates: Record<string, {lat: number, lng: number}> = {
      'Lagos': { lat: 6.5244, lng: 3.3792 },
      'Ogun': { lat: 7.1608, lng: 3.3477 },
      'Oyo': { lat: 8.0000, lng: 4.0000 },
      'Osun': { lat: 7.5629, lng: 4.5200 },
      'Ondo': { lat: 7.2500, lng: 5.2059 },
      'Ekiti': { lat: 7.7500, lng: 5.3100 },
      'Kwara': { lat: 8.9670, lng: 4.5616 },
      'FCT': { lat: 9.0579, lng: 7.4951 },
      'Kano': { lat: 11.9500, lng: 8.5167 }
    };

    const origin = stateCoordinates[request.fromState];
    const destination = stateCoordinates[request.toState];

    if (!origin || !destination) {
      return 200; // Default distance
    }

    // Calculate approximate distance using Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLng = (destination.lng - origin.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return Math.max(distance, 10); // Minimum 10km
  }

  private calculateWeight(request: DeliveryFeeRequest): number {
    const unitWeights = {
      'kg': request.weight,
      'bags': request.weight * 50,
      'baskets': request.weight * 25
    };
    return unitWeights[request.unit] * request.quantity;
  }

  private calculateDuration(distance: number): string {
    if (distance <= 30) return "Same day delivery";
    if (distance <= 80) return "Next day delivery";
    if (distance <= 150) return "1-2 business days";
    if (distance <= 300) return "2-4 business days";
    return "4-6 business days";
  }
}

class DeliveryService {
  private providers: DeliveryProvider[];
  private defaultProvider: DeliveryProvider;

  constructor() {
    // Initialize available providers
    this.providers = [
      new MockNigerianLogistics(),
      new GoogleMapsDeliveryService(),
      new GIGLogistics()
    ];

    // Set default provider (prefer real services over mock)
    this.defaultProvider = process.env.GOOGLE_MAPS_API_KEY 
      ? new GoogleMapsDeliveryService() 
      : new MockNigerianLogistics();
  }

  async calculateDeliveryFee(request: DeliveryFeeRequest, providerName?: string): Promise<DeliveryFeeResponse> {
    let provider = this.defaultProvider;

    // Use specific provider if requested
    if (providerName) {
      const requestedProvider = this.providers.find(p => 
        p.name.toLowerCase().includes(providerName.toLowerCase())
      );
      if (requestedProvider) {
        provider = requestedProvider;
      }
    }

    try {
      return await provider.calculateFee(request);
    } catch (error) {
      console.error(`Delivery calculation failed for ${provider.name}:`, error);
      
      // Fallback to mock provider if main provider fails
      if (provider !== this.providers[0]) {
        console.log('Falling back to mock provider');
        return await this.providers[0].calculateFee(request);
      }
      
      throw error;
    }
  }

  async compareProviders(request: DeliveryFeeRequest): Promise<DeliveryFeeResponse[]> {
    const results: DeliveryFeeResponse[] = [];

    // Get quotes from all available providers
    for (const provider of this.providers) {
      try {
        const quote = await provider.calculateFee(request);
        results.push(quote);
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
      }
    }

    // Sort by price (cheapest first)
    return results.sort((a, b) => a.deliveryFee - b.deliveryFee);
  }

  getAvailableProviders(): string[] {
    return this.providers.map(p => p.name);
  }
}

export const deliveryService = new DeliveryService();
export { DeliveryService, type DeliveryFeeResponse };