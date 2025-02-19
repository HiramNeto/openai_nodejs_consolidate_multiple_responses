require('dotenv').config();
const OpenAI = require('openai');

// Initialize the OpenAI client with your key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Asynchronous function to consolidate a lengthy transcription using ChatGPT
async function getChatCompletionsWithoutOutputLimit(
  messages,
  model,
  lastIterationData = { text: '', inputTokens: 0, outputTokens: 0 }
) {
  try {
    // Make the API call to chat.completions.create
    const response = await openai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0,
      max_tokens: 1000, //Forcing model to stop after 1000 tokens, in order to simulate the scenario where the output from the model is cut off.
    });

    // If the generation was cut off because it reached max_tokens, handle partial response
    if (response.choices[0].finish_reason === 'length') {
      console.log(
        `${new Date()}: ChatGPT returned before finishing. Reason: ${response.choices[0].finish_reason}`
      );

      // Push the partial response as an assistant message
      messages.push({
        role: 'assistant',
        content: response.choices[0].message.content,
      });
      // Add another user message asking to continue
      messages.push({
        role: 'user',
        content:
          'Please continue g.enerating your response where you stopped previously. Do not repeat anything from your previous response.',
      });

      // Update the iteration data with the partial output and token usage
      lastIterationData.text += response.choices[0].message.content;
      lastIterationData.inputTokens += response.usage.prompt_tokens;
      lastIterationData.outputTokens += response.usage.completion_tokens;

      // Recursively call our function to continue generating the text
      return await getChatCompletionsWithoutOutputLimit(
        messages,
        model,
        lastIterationData
      );
    } else {
      // The response finished normally, so we can return the result
      return {
        error: false,
        data: {
          text: lastIterationData.text + response.choices[0].message.content,
          tokens: {
            inputTokens:
              lastIterationData.inputTokens + response.usage.prompt_tokens,
            outputTokens:
              lastIterationData.outputTokens + response.usage.completion_tokens,
          },
        },
      };
    }
  } catch (error) {
    console.error('Error requesting from OpenAI:', error.message);
    return {
      error: true,
      message: `Error while getting completion from ChatGPT: ${error.message}`,
    };
  }
}

// Example usage
(async () => {
  // Our initial chat history
  const messages = [
    { role: 'user', content: 'Give me a detailed overview of quantum computing.' },
  ];

  const model = "gpt-4o";   // or any other model you’d like to use

  const result = await getChatCompletionsWithoutOutputLimit(messages, model);
  if (!result.error) {
    console.log('Final consolidated text:', result.data.text);
    console.log('Token usage:', result.data.tokens);
  } else {
    console.log('An error occurred:', result.message);
  }
})();