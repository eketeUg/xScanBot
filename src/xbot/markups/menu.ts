export const menuMarkup = async () => {
  return {
    message: `Choose an option:`,

    keyboard: [
      [
        {
          text: 'scan X account 🐦',
          callback_data: JSON.stringify({
            command: '/scanX',
            language: 'twitter',
          }),
        },
      ],
    ],
  };
};
