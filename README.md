# 🔥 STRD Burn Monitor Dashboard

A real-time dashboard for monitoring STRD (Stride) token burns on the Stride blockchain. This web application provides visual analytics and statistics for tracking the burn history of STRD tokens.

## 🌟 Features

- **Real-time Data**: Fetches burn data from Google Cloud Storage
- **Interactive Charts**: Visualize burn history with Chart.js
- **Multiple Timeframes**: View data for 1 week, 1 month, or all time
- **Chart Types**: Switch between cumulative and individual burn views
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Live Statistics**: Track total burned tokens and average daily burn size

## 📊 Dashboard Components

### Chart Section
- **Cumulative View**: Shows total STRD burned over time
- **Individual Burns**: Displays daily burn amounts
- **Time Controls**: Filter data by 1 week, 1 month, or all time periods

### Statistics Cards
- **Total Burned**: Total amount of STRD tokens burned
- **Average Daily Burn**: Average size of daily burns

## 🚀 Getting Started

### Prerequisites
- A modern web browser with JavaScript enabled
- Internet connection to fetch data from Google Cloud Storage

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/burn.github.io.git
   cd burn.github.io
   ```

2. Open `index.html` in your web browser or serve it using a local server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server
   ```

3. Navigate to `http://localhost:8000` in your browser

## 📈 Data Source

The dashboard fetches burn data from:
```
https://storage.googleapis.com/stride-public-data/burn_data/strd_burn.csv
```

The CSV file contains:
- **Timestamp**: Date and time of the burn record
- **Total Burned (microSTRD)**: Cumulative amount burned in microSTRD units

## 🛠️ Technical Details

### Technologies Used
- **HTML5**: Structure and semantic markup
- **CSS3**: Styling with custom properties and responsive design
- **JavaScript (ES6+)**: Interactive functionality and data processing
- **Chart.js**: Data visualization library
- **Google Fonts**: Inter font family for typography

### Key Features
- **Responsive Grid Layout**: Adapts to different screen sizes
- **Custom CSS Variables**: Consistent theming and easy customization
- **Error Handling**: Graceful fallback when data is unavailable
- **Performance Optimized**: Efficient data processing and chart rendering

## 🎨 Customization

### Styling
The dashboard uses CSS custom properties for easy theming:
```css
:root {
    --primary: #e50571;    /* Primary brand color */
    --dark: #3c001d;       /* Dark text color */
    --text: #37352F;       /* Body text color */
    --white: #ffffff;      /* White background */
    --border: #e9e9e7;     /* Border color */
}
```

### Data Processing
The application processes microSTRD values (1 STRD = 1,000,000 microSTRD) and calculates:
- Daily burn amounts from cumulative totals
- Average burn sizes from non-zero daily burns
- Filtered datasets based on selected timeframes

## 🔗 Related Links

- **Twitter Bot**: [@StrideBurnBot](https://x.com/StrideBurnBot/) - Follow for burn notifications
- **Stride Protocol**: [Official Website](https://stride.zone/)
- **Data Source**: Google Cloud Storage burn data

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Stride Protocol team for providing burn data
- Chart.js community for the excellent charting library
- Inter font family by Google Fonts

---

**Note**: This dashboard is designed to work with the Stride blockchain's burn mechanism. Data accuracy depends on the availability and correctness of the Google Cloud Storage data source. 