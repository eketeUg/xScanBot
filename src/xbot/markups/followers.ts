export const followersMarkUp = async (followers: any) => {
  return {
    message: `<b>Follwers with 90k and above followers</b>:\n\n${followers
      .map(
        (user) =>
          `➡️<a href="https://x.com/${user.username}">@${user.username}</a> - followers:${user.followersCount}`,
      )
      .join('\n')}`,

    keyboard: [
      [
        {
          text: 'close ❌',
          callback_data: JSON.stringify({
            command: '/close',
            language: 'twitter',
          }),
        },
      ],
    ],
  };
};
